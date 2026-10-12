// Sirve la app compilada (dist/) en Railway (servicio horex-web) sólo con módulos de Node.
// Las rutas que no son archivo devuelven index.html (rutas del cliente). /salud es el healthcheck.
// En la Fase 3 aquí se agrega el reenvío de /api/* a horex-api por la red privada (variable API_INTERNA).
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PUERTO = Number(process.env.PORT) || 3000;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const COMPRIMIBLES = new Set(['.html', '.js', '.css', '.json', '.svg']);

async function infoArchivo(ruta) {
  try {
    const s = await stat(ruta);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
}

async function responder(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/salud') return res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');

  let pedido;
  try {
    pedido = decodeURIComponent(url.pathname);
  } catch {
    return res.writeHead(400).end();
  }
  let ruta = normalize(join(RAIZ, pedido));
  if (ruta !== RAIZ && !ruta.startsWith(RAIZ + sep)) return res.writeHead(403).end();

  let info = await infoArchivo(ruta);
  if (!info) {
    // Un archivo con extensión que no existe es un 404 real; lo demás es una ruta de la app.
    if (extname(pedido)) return res.writeHead(404).end();
    ruta = join(RAIZ, 'index.html');
    info = await infoArchivo(ruta);
  }

  const extension = extname(ruta);
  const cabeceras = {
    'content-type': TIPOS[extension] ?? 'application/octet-stream',
    // Los archivos de assets/ llevan hash en el nombre: se pueden guardar para siempre.
    'cache-control': pedido.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
  };
  const gzip = COMPRIMIBLES.has(extension) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (gzip) {
    cabeceras['content-encoding'] = 'gzip';
    cabeceras.vary = 'Accept-Encoding';
  } else {
    cabeceras['content-length'] = info.size;
  }
  res.writeHead(200, cabeceras);
  if (req.method === 'HEAD') return res.end();
  const flujo = createReadStream(ruta);
  (gzip ? flujo.pipe(createGzip()) : flujo).pipe(res);
}

createServer((req, res) => {
  responder(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
}).listen(PUERTO, () => console.log(`horex-web escuchando en :${PUERTO}`));
