// Cloud Functions de ImProX.
//
// No mandan el mail directamente: escriben un documento en la colección "mail" de
// Firestore, que la extensión oficial de Firebase "Trigger Email from Firestore"
// (Firebase Extensions → firestore-send-email) toma y envía por SMTP. Esto evita
// tener que escribir y mantener el código de envío (autenticación SMTP, reintentos,
// etc.) a mano.
//
// Requisitos para que esto funcione en producción (ver README de este directorio):
//   1) Proyecto Firebase en el plan Blaze (pago por uso).
//   2) Extensión "Trigger Email from Firestore" instalada, escribiendo a la
//      colección "mail" y con un proveedor SMTP configurado.
//   3) `firebase deploy --only functions` desde este repo.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const APP_URL = 'https://improx.vercel.app';
// Remitente por defecto: reemplazalo por el que hayas verificado en tu proveedor SMTP
// al configurar la extensión "Trigger Email from Firestore".
const FROM_ADDRESS = 'ImProX <no-reply@improx.app>';
const TRIAL_DAYS = 7;

const emailLayout = (title, bodyHtml) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
    <h2 style="margin-bottom: 8px;">${title}</h2>
    ${bodyHtml}
    <p style="color:#94a3b8; font-size: 12px; margin-top: 32px;">ImProX — Planificador Inteligente DTF/UV</p>
  </div>
`;

const ctaButton = (href, label) => `
  <p>
    <a href="${href}" style="background: linear-gradient(90deg,#7c3aed,#06b6d4); color: #fff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block;">
      ${label}
    </a>
  </p>
`;

// Se dispara apenas se crea el perfil de un usuario nuevo, justo cuando arranca su
// prueba gratis (ver src/useAuth.js: el perfil se crea en el primer login).
exports.sendWelcomeEmail = onDocumentCreated('users/{uid}', async (event) => {
  const data = event.data?.data();
  if (!data?.email) return;

  const greeting = data.displayName ? `Hola ${data.displayName},` : 'Hola,';

  await db.collection('mail').add({
    to: data.email,
    from: FROM_ADDRESS,
    message: {
      subject: '¡Bienvenido a ImProX! 🎉',
      html: emailLayout('¡Bienvenido a ImProX!', `
        <p>${greeting}</p>
        <p>Tu cuenta ya está lista. Tenés <strong>${TRIAL_DAYS} días de prueba gratis</strong> con acceso
        completo: subida masiva de imágenes, eliminación de fondo, bordes de sticker configurables,
        armado automático de planchas y exportación a PDF.</p>
        ${ctaButton(`${APP_URL}/app`, 'Entrar a ImProX')}
        <p style="color:#64748b; font-size: 13px;">Cuando termine tu prueba, vas a poder elegir un plan
        pago para seguir usando la herramienta sin cortes.</p>
      `),
    },
  });
});

// Corre todos los días a las 9am (hora Argentina). Le manda el recordatorio a cada
// cuenta en plan "trial" a la que le queda exactamente 1 día (o sea, cumplió el día 6).
exports.sendTrialReminder = onSchedule(
  { schedule: 'every day 09:00', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const snapshot = await db.collection('users').where('plan', '==', 'trial').get();
    const now = Date.now();

    const jobs = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (!data.email || !data.trialStartedAt || data.reminder6Sent) return;

      const startedMs = data.trialStartedAt.toMillis
        ? data.trialStartedAt.toMillis()
        : new Date(data.trialStartedAt).getTime();
      const elapsedDays = (now - startedMs) / (1000 * 60 * 60 * 24);

      // Ya pasó el día 6 completo pero todavía no el día 7 (último): le queda 1 día.
      if (elapsedDays < 6 || elapsedDays >= 7) return;

      const greeting = data.displayName ? `Hola ${data.displayName},` : 'Hola,';

      await db.collection('mail').add({
        to: data.email,
        from: FROM_ADDRESS,
        message: {
          subject: 'Mañana se acaba tu prueba gratis de ImProX ⏳',
          html: emailLayout('Mañana se termina tu prueba gratis', `
            <p>${greeting}</p>
            <p>Mañana se cumplen los ${TRIAL_DAYS} días de prueba gratis de ImProX. Para seguir armando
            tus planchas sin interrupciones, elegí un plan antes de que se corte el acceso:</p>
            ${ctaButton(`${APP_URL}/#planes`, 'Ver planes y precios')}
          `),
        },
      });

      await docSnap.ref.update({ reminder6Sent: true });
    });

    await Promise.all(jobs);
  }
);
