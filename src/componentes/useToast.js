import { createContext, useContext } from 'react';

export const ContextoToast = createContext(() => {});

/** Devuelve toast(mensaje): muestra el aviso 2.6 s, como la demo. */
export const useToast = () => useContext(ContextoToast);
