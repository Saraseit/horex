import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/layout.css';
import './estilos/componentes.css';

import App from './App.jsx';
import ProveedorToast from './componentes/Toast.jsx';
import { ErrorApi } from './datos/api.js';
import { CLAVE_SESION } from './sesion/contexto.js';
import ProveedorSesion from './sesion/ProveedorSesion.jsx';

// Si cualquier petición responde 401 (sesión vencida o usuario desactivado), se vuelve a preguntar
// por la sesión y RutaProtegida manda al login.
function alFallar(error) {
  if (error instanceof ErrorApi && error.estado === 401) clienteConsultas.invalidateQueries({ queryKey: CLAVE_SESION });
}

const clienteConsultas = new QueryClient({
  queryCache: new QueryCache({ onError: alFallar }),
  mutationCache: new MutationCache({ onError: alFallar }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (intentos, error) => !(error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) && intentos < 2,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={clienteConsultas}>
      <BrowserRouter>
        <ProveedorToast>
          <ProveedorSesion>
            <App />
          </ProveedorSesion>
        </ProveedorToast>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
