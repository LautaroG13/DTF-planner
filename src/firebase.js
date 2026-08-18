import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Proyecto Firebase reutilizado de la versión anterior de la app (dtf-planner):
// ya tiene el proveedor de Google habilitado en Authentication -> Sign-in method,
// así que el login funciona sin crear un proyecto nuevo.
const firebaseConfig = {
  apiKey: "AIzaSyBLh4BqwjsIsELfU6hcss6XdQVNcD78ktE",
  authDomain: "dtf-planner.firebaseapp.com",
  projectId: "dtf-planner",
  storageBucket: "dtf-planner.firebasestorage.app",
  messagingSenderId: "681992689098",
  appId: "1:681992689098:web:c1ee9e6b7dd809c99beb33",
  measurementId: "G-QQEJLNGNZS"
};

// Evita doble inicialización en Hot Reload de Vite.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
