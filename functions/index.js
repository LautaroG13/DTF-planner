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
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();

const APP_URL = 'https://improx.vercel.app';
// Remitente por defecto: reemplazalo por el que hayas verificado en tu proveedor SMTP
// al configurar la extensión "Trigger Email from Firestore".
const FROM_ADDRESS = 'ImProX <no-reply@improx.app>';
const TRIAL_DAYS = 7;

// Access Token de producción de Mercado Pago (Developers → Tus integraciones →
// credenciales de producción). Se configura como secret, nunca como texto plano:
//   firebase functions:secrets:set MP_ACCESS_TOKEN
const MP_ACCESS_TOKEN = defineSecret('MP_ACCESS_TOKEN');

// Debe coincidir con src/plans.js (id, name, price). Se duplica acá porque
// functions/ es un proyecto Node/CommonJS aparte del frontend (Vite/ESM).
const PLANS = [
  { id: 'base', name: 'Base', price: 2000 },
  { id: 'medio', name: 'Medio', price: 3000 },
  { id: 'premium', name: 'Premium', price: 8000 },
];

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
//
// Si alguien pagó un plan ANTES de crearse la cuenta (pagó desde la landing con el
// mismo correo, pero todavía no había iniciado sesión en ImProX), mercadoPagoWebhook
// dejó una "activación pendiente" guardada por correo: acá la consumimos y el usuario
// arranca directo con el plan pago en vez de con el trial.
exports.sendWelcomeEmail = onDocumentCreated('users/{uid}', async (event) => {
  const snap = event.data;
  const data = snap?.data();
  if (!data?.email) return;

  const greeting = data.displayName ? `Hola ${data.displayName},` : 'Hola,';
  const emailKey = data.email.toLowerCase();

  const pendingRef = db.collection('pendingActivations').doc(emailKey);
  const pendingSnap = await pendingRef.get();

  if (pendingSnap.exists) {
    const pending = pendingSnap.data();
    const plan = PLANS.find((p) => p.id === pending.planId);
    if (plan) {
      await snap.ref.update({ plan: plan.id, planActivatedAt: FieldValue.serverTimestamp() });
      await pendingRef.delete();

      await db.collection('mail').add({
        to: data.email,
        from: FROM_ADDRESS,
        message: {
          subject: `¡Bienvenido a ImProX! Tu plan ${plan.name} ya está activo 🎉`,
          html: emailLayout('¡Bienvenido a ImProX!', `
            <p>${greeting}</p>
            <p>Ya habíamos recibido tu pago del plan <strong>${plan.name}</strong>: tu cuenta arranca
            directo con ese plan activo, sin límite de prueba.</p>
            ${ctaButton(`${APP_URL}/app`, 'Entrar a ImProX')}
          `),
        },
      });
      return;
    }
  }

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

// Webhook de Mercado Pago: se configura en Developers → Tus integraciones → tu
// aplicación → Webhooks, apuntando a la URL de esta función (la ves en la consola
// de Firebase → Functions, después del primer deploy).
//
// Los links de pago de la landing son fijos por plan (no personalizados por usuario),
// así que identificamos qué plan se compró por el MONTO pagado, y a qué cuenta de
// ImProX corresponde por el CORREO con el que se pagó. Por eso la landing le pide al
// usuario que pague con el mismo correo de su cuenta.
//
// Importante: nunca confiamos en el contenido del webhook en sí (cualquiera podría
// mandarnos un POST fabricado). Apenas llega un aviso, volvemos a consultar el pago
// real en la API de Mercado Pago con nuestro Access Token antes de activar nada.
// Además es idempotente (guarda cada payment id ya procesado) para no reprocesar
// reintentos del mismo aviso.
exports.mercadoPagoWebhook = onRequest({ secrets: [MP_ACCESS_TOKEN] }, async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id;
    if (!paymentId) {
      res.status(200).send('ignored: sin payment id');
      return;
    }

    const processedRef = db.collection('payments').doc(String(paymentId));
    if ((await processedRef.get()).exists) {
      res.status(200).send('ya procesado');
      return;
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN.value()}` },
    });

    if (!mpResponse.ok) {
      console.error('No se pudo consultar el pago en Mercado Pago', paymentId, mpResponse.status);
      res.status(200).send('no se pudo verificar el pago');
      return;
    }

    const payment = await mpResponse.json();

    if (payment.status !== 'approved') {
      res.status(200).send(`estado del pago: ${payment.status}`);
      return;
    }

    const payerEmail = payment.payer?.email?.toLowerCase();
    const amount = payment.transaction_amount;
    const plan = PLANS.find((p) => Math.abs(p.price - amount) < 1);

    if (!payerEmail || !plan) {
      console.warn('Pago aprobado pero no se pudo identificar plan o correo', { paymentId, payerEmail, amount });
      await processedRef.set({ processedAt: FieldValue.serverTimestamp(), matched: false, payerEmail: payerEmail || null, amount });
      res.status(200).send('pago aprobado pero sin plan/correo identificable');
      return;
    }

    const usersSnap = await db.collection('users').where('email', '==', payerEmail).limit(1).get();

    if (usersSnap.empty) {
      // Pagó pero todavía no tiene cuenta en ImProX (o se registró con otro correo).
      // Dejamos la activación pendiente: sendWelcomeEmail la consume si esa cuenta se crea después.
      await db.collection('pendingActivations').doc(payerEmail).set({
        planId: plan.id,
        paymentId: String(paymentId),
        createdAt: FieldValue.serverTimestamp(),
      });
      await processedRef.set({ processedAt: FieldValue.serverTimestamp(), matched: false, payerEmail, plan: plan.id });
      res.status(200).send('pago aprobado, sin cuenta todavía: activación pendiente guardada');
      return;
    }

    const userDoc = usersSnap.docs[0];
    await userDoc.ref.update({ plan: plan.id, planActivatedAt: FieldValue.serverTimestamp() });

    await db.collection('mail').add({
      to: payerEmail,
      from: FROM_ADDRESS,
      message: {
        subject: `¡Pago aprobado! Ya tenés el plan ${plan.name} en ImProX 🎉`,
        html: emailLayout('¡Pago aprobado!', `
          <p>Tu pago se acreditó correctamente y tu suscripción al plan <strong>${plan.name}</strong>
          ya está activa en tu cuenta de ImProX.</p>
          ${ctaButton(`${APP_URL}/app`, 'Entrar a ImProX')}
        `),
      },
    });

    await processedRef.set({
      processedAt: FieldValue.serverTimestamp(),
      matched: true,
      plan: plan.id,
      uid: userDoc.id,
      payerEmail,
    });

    res.status(200).send('ok');
  } catch (err) {
    console.error('Error procesando webhook de Mercado Pago', err);
    // Respondemos 200 igual para que Mercado Pago no reintente en loop; el error queda logueado.
    res.status(200).send('error interno, revisar logs');
  }
});

// El front (src/useAuth.js) ya no crea el perfil de Firestore de una cuenta hasta
// que verifica el correo — así nadie puede "ocupar" el email de otra persona para
// robarle una activación de plan. El efecto secundario es que alguien podría
// registrarse con un correo ajeno y dejarlo sin verificar para siempre, bloqueando
// que el dueño real se registre con ese mismo correo. Esta función limpia esas
// cuentas fantasma: corre a diario y borra las que llevan más de 7 días sin
// verificar (nunca llegaron a tener trial ni plan, así que no se pierde nada real).
exports.cleanupUnverifiedAccounts = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const auth = getAuth();
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const uidsToDelete = [];
    let pageToken;

    do {
      const result = await auth.listUsers(1000, pageToken);
      result.users.forEach((u) => {
        if (!u.emailVerified && new Date(u.metadata.creationTime).getTime() < cutoffMs) {
          uidsToDelete.push(u.uid);
        }
      });
      pageToken = result.pageToken;
    } while (pageToken);

    for (let i = 0; i < uidsToDelete.length; i += 1000) {
      await auth.deleteUsers(uidsToDelete.slice(i, i + 1000));
    }
  }
);
