# Mails de ImProX (bienvenida + recordatorio del día 6)

Este directorio tiene el código de dos Cloud Functions:

- **`sendWelcomeEmail`**: se dispara sola apenas alguien se registra (cuando se crea
  su perfil en Firestore) y le manda el mail de bienvenida.
- **`sendTrialReminder`**: corre todos los días a las 9am (hora Argentina) y le
  manda un recordatorio a quien le queda 1 día de prueba gratis ("mañana se te
  corta el acceso").

Ninguna de las dos manda el mail directamente: escriben un documento en la
colección `mail` de Firestore, y una extensión oficial de Firebase se encarga
de convertir eso en un envío real por SMTP. Esto es así para no tener que
programar ni mantener a mano la parte de autenticación SMTP.

Yo no puedo desplegar esto por vos: necesita tu cuenta de Firebase y tus
credenciales de SMTP. Estos son los pasos, uno por uno.

## 1. Pasar el proyecto a plan Blaze

Cloud Functions (incluidas las programadas, como el recordatorio diario) solo
funcionan en el plan **Blaze** (pago por uso). Tiene una capa gratuita amplia:
para el volumen que vas a tener al principio, probablemente pagues $0.

1. Andá a la [consola de Firebase](https://console.firebase.google.com/) →
   proyecto **dtf-planner**.
2. Abajo a la izquierda, click en "Actualizar" / "Upgrade" → elegí **Blaze**.
3. Vinculá una tarjeta (Google te la pide, aunque no se cobre nada al inicio).

## 2. Elegir un proveedor SMTP

Necesitás un servicio que realmente entregue los mails. Opciones simples para
empezar (todas tienen plan gratuito):

- **[Brevo](https://www.brevo.com/)** (ex Sendinblue): recomendado para
  arrancar, fácil de configurar, buen nivel de entrega.
- **SendGrid**, **Mailgun**, o cualquier otro que te dé credenciales SMTP
  (host, puerto, usuario, contraseña).

Creá la cuenta, verificá tu dominio o remitente, y guardá los datos SMTP
(host, puerto, usuario, contraseña) — los vas a necesitar en el paso 4.

## 3. Instalar la extensión "Trigger Email from Firestore"

1. En la consola de Firebase → **Extensions** (o **Extensiones**) → buscar
   **"Trigger Email"** → instalar la de Firebase (`firestore-send-email`).
2. Durante la instalación te va a pedir:
   - **Colección de Firestore a monitorear**: escribí `mail` (así se llama la
     colección que usan las Cloud Functions de este repo).
   - **Configuración SMTP**: host, puerto, usuario y contraseña del proveedor
     que elegiste en el paso 2.
3. Confirmá la instalación (puede tardar unos minutos).

## 4. Ajustar el remitente en el código (opcional pero recomendado)

En `functions/index.js`, cambiá esta línea por el remitente que verificaste
en tu proveedor SMTP:

```js
const FROM_ADDRESS = 'ImProX <no-reply@improx.app>';
```

## 5. Instalar Firebase CLI y desplegar

Desde una terminal, parado en la raíz de este repo:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only functions
```

Con eso quedan publicadas ambas funciones. Podés confirmar que están activas
en la consola de Firebase → **Functions**.

## Cómo probarlo

- **Bienvenida**: registrate con una cuenta nueva en `https://improx.vercel.app`
  y en unos segundos debería llegar el mail.
- **Recordatorio del día 6**: no hace falta esperar 6 días para probarlo — en
  la consola de Firebase → Firestore → colección `users` → tu documento,
  podés editar a mano el campo `trialStartedAt` para que quede "6 días atrás"
  y esperar a que corra la función programada (o dispararla manualmente desde
  la consola de Cloud Functions con el botón "Probar función").

## Nota sobre seguridad

Estas funciones usan el SDK de administrador de Firebase, así que no dependen
de las reglas de seguridad de Firestore para funcionar. Pero el resto de la
app (el conteo de días de prueba en el cliente) sigue sin reglas de
seguridad configuradas — es un límite "blando" que un usuario técnico podría
manipular. Si querés, en otro paso puedo dejarte el texto de reglas de
Firestore para cerrar eso.
