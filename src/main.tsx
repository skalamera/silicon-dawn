import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) {
        reloaded = true;
        window.location.reload();
      }
    });

    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {
        // Service worker registration skipped in restricted contexts
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
