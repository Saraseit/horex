import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
import ProveedorSesion from './sesion/ProveedorSesion.jsx';

const clienteConsultas = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
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
