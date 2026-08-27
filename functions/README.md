# Cloud Functions de ImProX (mails + activación de pagos)

Este directorio tiene el código de cuatro Cloud Functions:

- **`sendWelcomeEmail`**: se dispara sola apenas alguien verifica su correo y se
  crea su perfil en Firestore, y le manda el mail de bienvenida. Si esa persona ya
  había pagado un plan antes de registrarse (mismo correo), la cuenta arranca
  directo con ese plan activo en vez de con el trial.
- **`sendTrialReminder`**: corre todos los días a las 9am (hora Argentina) y le
  manda un recordatorio a quien le queda 1 día de prueba gratis ("mañana se te
  corta el acceso").
- **`mercadoPagoWebhook`**: recibe el aviso de Mercado Pago cuando se aprueba un
  pago, activa el plan correspondiente en la cuenta de ImProX que coincida por
  correo, y manda el mail de "pago aprobado".
- **`cleanupUnverifiedAccounts`**: corre a diario y borra las cuentas que se
  registraron con correo/contraseña y nunca verificaron el correo en 7 días (evita
  que alguien deje "ocupado" para siempre el correo de otra persona sin usarlo).

El registro con correo y contraseña ahora exige verificar el email antes de poder
usar la herramienta: el perfil de Firestore (y el arranque del trial) recién se
crea cuando `user.emailVerified` es `true`. Antes no era así, y eso permitía que
alguien se registrara con el correo de otra persona para robarle la activación de
un plan pago cuando esa persona pagara de verdad (ver `mercadoPagoWebhook` abajo).

Los mails no se mandan directamente desde el código: se escribe un documento en la
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
   - **Ubicación de Cloud Functions ("Cloud Functions location")**: tiene que
     coincidir con la región de tu base de Firestore. Este proyecto
     (`dtf-planner`) tiene su Firestore en la multi-región **nam5** (EE.UU.),
     así que elegí **`us-central1`**. Si elegís otra (por ejemplo
     `southamerica-east1`), la instalación falla con un error tipo
     `Database '(default)' does not exist in region ...` — si te pasa eso,
     desinstalá la extensión y volvé a instalarla eligiendo `us-central1`.
     (Para ver la región de tu propia base: Firestore Database → pestaña
     Datos, se muestra arriba junto al nombre `(default)`.)
3. Confirmá la instalación (puede tardar unos minutos).

Por la misma razón, `functions/index.js` fija `us-central1` como región para
todas las Cloud Functions de este repo (`setGlobalOptions`) — así
`sendWelcomeEmail`, que escucha cambios en Firestore, queda en la misma
región que la base y no falla por el mismo motivo.

## 4. Ajustar el remitente en el código (opcional pero recomendado)

En `functions/index.js`, cambiá esta línea por el remitente que verificaste
en tu proveedor SMTP:

```js
const FROM_ADDRESS = 'ImProX <no-reply@improx.app>';
```

## 5. Configurar el Access Token de Mercado Pago

`mercadoPagoWebhook` necesita tu Access Token de **producción** (no el de prueba)
para poder consultar cada pago y confirmar que sea real:

1. Andá a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel) →
   tu aplicación → **Credenciales de producción** → copiá el **Access Token**.
2. Guardalo como secret de Firebase (te va a pedir que lo pegues, no se guarda en
   el código ni en el repo):

```bash
firebase functions:secrets:set MP_ACCESS_TOKEN
```

## 6. Instalar Firebase CLI y desplegar

Desde una terminal, parado en la raíz de este repo:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only functions,firestore:rules
```

Con eso quedan publicadas las cuatro funciones (`sendWelcomeEmail`,
`sendTrialReminder`, `mercadoPagoWebhook`, `cleanupUnverifiedAccounts`) **y**
las reglas de seguridad de Firestore (`firestore.rules`). Podés confirmar que
las funciones están activas en la consola de Firebase → **Functions** — ahí
también vas a ver la URL pública de `mercadoPagoWebhook` (algo como
`https://us-central1-dtf-planner.cloudfunctions.net/mercadoPagoWebhook`).

**Importante:** el paso `firestore:rules` no es opcional. Sin las reglas de
`firestore.rules` desplegadas, cualquier usuario logueado puede escribir su
propio documento en `users/{uid}` directo desde el navegador y ponerse
`plan: 'premium'` sin pagar nada — las reglas son lo único que se lo impide
(las Cloud Functions usan el Admin SDK y las esquivan siempre, así que
`mercadoPagoWebhook` y los recordatorios siguen funcionando igual).

## 7. Configurar el webhook en Mercado Pago

1. En [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel) →
   tu aplicación → **Webhooks** → **Configurar notificaciones**.
2. Pegá la URL de `mercadoPagoWebhook` del paso anterior.
3. Marcá el evento **Pagos** (`payment`).
4. Guardá. Mercado Pago suele dejarte mandar un evento de prueba desde ahí mismo
   para confirmar que la URL responde bien (debería devolver `200`).

## Cómo probarlo

- **Bienvenida**: registrate con una cuenta nueva en `https://improx.vercel.app`
  y en unos segundos debería llegar el mail.
- **Recordatorio del día 6**: no hace falta esperar 6 días para probarlo — en
  la consola de Firebase → Firestore → colección `users` → tu documento,
  podés editar a mano el campo `trialStartedAt` para que quede "6 días atrás"
  y esperar a que corra la función programada (o dispararla manualmente desde
  la consola de Cloud Functions con el botón "Probar función").
- **Pago aprobado**: hacé un pago real (o de prueba, si usás credenciales de
  test en vez de producción) con el mismo correo de una cuenta de ImProX, y
  verificá en Firestore → `users` → tu documento que el campo `plan` haya
  cambiado, y que llegue el mail de "pago aprobado".

## Cómo identifica el plan y la cuenta (y sus límites)

Los 3 links de pago de la landing son fijos por plan, no personalizados por
usuario. Por eso `mercadoPagoWebhook`:

- Identifica **qué plan** se compró por el **monto pagado** (tiene que coincidir
  con alguno de los precios en `PLANS` dentro de `functions/index.js` — si cambiás
  un precio en `src/plans.js`, actualizá también acá).
- Identifica **qué cuenta de ImProX** activar por el **correo con el que se pagó**
  en Mercado Pago, buscándolo entre los usuarios de Firestore. Por eso la landing
  le pide a quien paga que use el mismo correo de su cuenta.
- Si paga alguien que todavía no tiene cuenta (o pagó con un correo distinto),
  la activación queda "pendiente" por correo y se aplica sola apenas esa persona
  se registre en ImProX con ese mismo correo.
- Si alguien paga con un correo distinto al de su cuenta y nunca se registra con
  el correo del pago, no hay forma automática de asociarlo — habría que activarlo
  a mano desde Firestore (campo `plan` en `users/{uid}`).

**Nota de seguridad**: esta función no verifica la firma criptográfica del
webhook (Mercado Pago ofrece esa opción, pero no la implementé para no
arriesgarme a un detalle mal implementado). En cambio, nunca confía en el
contenido del aviso: siempre vuelve a consultar el pago real contra la API de
Mercado Pago con tu Access Token antes de activar nada, y es idempotente (no
reprocesa un mismo pago dos veces). Es una protección razonable para el
volumen inicial; si más adelante querés blindarlo más, se puede sumar la
verificación de firma (`x-signature`) que documenta Mercado Pago.

## Nota sobre seguridad

Estas funciones usan el SDK de administrador de Firebase, así que no dependen
de las reglas de seguridad de Firestore para funcionar — `mercadoPagoWebhook`
y los recordatorios siguen andando igual aunque las reglas estén activas.

El resto de la app ya está cerrado con dos cambios:

1. **`firestore.rules`** (raíz del repo) impide que un usuario logueado escriba
   `plan` o `trialStartedAt` en su propio perfil desde el navegador — antes
   cualquiera podía auto-otorgarse un plan pago editando esos campos a mano
   desde la consola. Solo el Admin SDK (las Cloud Functions) puede tocarlos.
   Recordá desplegarlas con `firebase deploy --only firestore:rules` (paso 6).
2. **Verificación de correo obligatoria** antes de crear el perfil (y arrancar
   el trial), para que nadie pueda registrarse con el correo de otra persona
   y robarle la activación de un plan pago.
