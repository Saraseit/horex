import { useState } from 'react';
import { generarRecibos, nombreArchivoRecibos } from '../logica/recibo.js';
import { descargarArchivo } from './descargar.js';
import { useToast } from './useToast.js';

/** Descarga los recibos (PDF) de una lista de registros. */
export function useRecibos() {
  const toast = useToast();
  const [generando, setGenerando] = useState(false);
  async function descargar(registros, fechaPago) {
    if (!registros.length) return;
    if (!fechaPago) { toast('Escribe la fecha de pago para el recibo'); return; }
    setGenerando(true);
    try {
      descargarArchivo(await generarRecibos(registros, { fechaPago }), nombreArchivoRecibos(registros));
    } catch (e) {
      toast(`No se pudo generar el recibo: ${e.message}`);
    } finally {
      setGenerando(false);
    }
  }
  return { descargar, generando };
}
