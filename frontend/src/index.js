import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { adoptarPrerender } from "@/lib/prerender";
import { programarAnalitica } from "@/lib/analitica";

// Suppress benign ResizeObserver error from UI libraries
window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver loop')) e.stopImmediatePropagation();
});

const contenedor = document.getElementById("root");
// El texto que puso el servidor en las paginas publicas queda a la vista
// hasta que React pinte la suya (ver lib/prerender.js).
adoptarPrerender(contenedor);
const root = ReactDOM.createRoot(contenedor);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register the service worker for offline app shell + background sync.
// Only register in production to avoid interfering with hot reload.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('Service worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}

// PostHog despues de la primera interaccion o en reposo (ver lib/analitica.js).
programarAnalitica();
