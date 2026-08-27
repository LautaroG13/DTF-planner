// Google Analytics 4 (opcional): no hace nada hasta que configures
// VITE_GA_MEASUREMENT_ID en las variables de entorno de Vercel
// (Project Settings → Environment Variables) con tu Measurement ID
// (algo como "G-XXXXXXXXXX", lo sacás de tu propiedad de Google Analytics).
// No hace falta tocar código para activarla: solo cargar la variable y redeployar.
export function initGoogleAnalytics() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId || typeof window === 'undefined' || window.gtag) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
}

// Registra una pageview manual: hace falta porque el ruteo de ImProX es
// propio (history.pushState en main.jsx), no un router que gtag reconozca solo.
export function trackPageview(path) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', { page_path: path });
}
