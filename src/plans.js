// Configuración compartida de planes: la usan tanto la landing (para mostrar precios
// y los links de pago) como la app (para saber qué mostrarle a cada usuario).
// Los precios acá deben coincidir con los de functions/index.js (mercadoPagoWebhook
// identifica el plan comprado por el monto pagado).

export const TRIAL_DAYS = 7;

export const PLANS = [
  {
    id: 'base',
    name: 'Base',
    price: 2000,
    oldPrice: 10000,
    paymentLink: 'https://mpago.la/1ZjtDv3',
    tagline: 'Para arrancar y probar la herramienta a fondo.',
    downloadLimit: '20 descargas por mes',
    features: [
      'Empaquetado automático de planchas (por temática o mezclado)',
      'Subida de imágenes en lote, se acomodan solas',
      'Recorte y redimensionado por sticker',
      'Exportación a PDF listo para imprimir',
    ],
    highlight: false,
  },
  {
    id: 'medio',
    name: 'Medio',
    price: 3000,
    oldPrice: 15000,
    paymentLink: 'https://mpago.la/1w7KKj9',
    tagline: 'El más elegido: suma edición avanzada de imagen.',
    downloadLimit: '150 descargas por mes',
    features: [
      'Todo lo del plan Base',
      'Eliminación de fondo (bordes conectados + autodetección + cuentagotas)',
      'Borde / contorno de sticker configurable',
      'Organización por temáticas ilimitadas',
    ],
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 8000,
    oldPrice: 45000,
    paymentLink: 'https://mpago.la/2HwvPD6',
    tagline: 'Para talleres con volumen alto de impresión.',
    downloadLimit: 'Descargas ilimitadas',
    features: [
      'Todo lo del plan Medio',
      'Descargas ilimitadas, sin cortes a fin de mes',
      'Acceso anticipado a las funciones "Próximamente"',
      'Soporte prioritario por correo electrónico',
    ],
    highlight: false,
  },
];

// Calcula cuántos días de prueba le quedan a un perfil de Firestore (plan === 'trial').
export function getTrialStatus(profile) {
  if (!profile || profile.plan !== 'trial') {
    return { isTrial: false, isExpired: false, daysLeft: null };
  }
  // trialStartedAt puede tardar un instante en resolverse (serverTimestamp pendiente).
  if (!profile.trialStartedAt) {
    return { isTrial: true, isExpired: false, daysLeft: TRIAL_DAYS };
  }
  const startedMs = typeof profile.trialStartedAt.toMillis === 'function'
    ? profile.trialStartedAt.toMillis()
    : new Date(profile.trialStartedAt).getTime();
  const elapsedDays = (Date.now() - startedMs) / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));
  return { isTrial: true, isExpired: elapsedDays >= TRIAL_DAYS, daysLeft };
}
