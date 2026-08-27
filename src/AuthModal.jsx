import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import { TRIAL_DAYS } from './plans.js';

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Probá iniciar sesión.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/user-not-found': 'No encontramos una cuenta con ese correo.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá un momento y volvé a intentar.',
  'auth/admin-restricted-operation': "El login está restringido en este proyecto de Firebase. Activá el proveedor correspondiente en Authentication → Sign-in method.",
  'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión todavía.',
};

function friendlyError(err) {
  return ERROR_MESSAGES[err?.code] || 'Algo salió mal. Probá de nuevo en un momento.';
}

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        // No confiamos en el correo hasta que se verifique: así una cuenta nueva no
        // puede "ocupar" el email de otra persona para robarle una activación de plan.
        await sendEmailVerification(credential.user, { url: 'https://improx.vercel.app/' });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err) {
      console.error('Error de autenticación: ', err);
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error('Error al iniciar sesión con Google: ', err);
        setError(friendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Escribí tu correo primero para poder enviarte el link de recuperación.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo('Te enviamos un correo para restablecer tu contraseña.');
    } catch (err) {
      console.error('Error al enviar el correo de recuperación: ', err);
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl animate-scale-up overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-black text-white">
              {mode === 'login' ? 'Iniciá sesión' : 'Creá tu cuenta gratis'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'login'
                ? 'Para entrar a ImProX necesitás una cuenta.'
                : `Arrancás con ${TRIAL_DAYS} días de prueba gratis, acceso completo.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 bg-transparent border-none cursor-pointer text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-4 flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-slate-400 font-semibold block mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] text-slate-400 font-semibold">Contraseña</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 bg-transparent border-none cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">Repetir contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
          )}
          {info && (
            <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-3 py-2">{info}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-sm transition-all active:scale-95 cursor-pointer mt-1"
          >
            {loading ? 'Un momento...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta gratis'}
          </button>
        </form>

        <div className="flex items-center gap-3 px-6 my-4">
          <div className="h-px bg-slate-800 flex-1"></div>
          <span className="text-[10px] text-slate-500 font-bold uppercase">o</span>
          <div className="h-px bg-slate-800 flex-1"></div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-3">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full bg-slate-950 hover:bg-slate-900 disabled:opacity-50 text-slate-200 border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.12 1 1.16 6.12 1 12.24s5.12 11.24 11.24 11.24c6.38 0 10.62-4.474 10.62-10.782 0-.728-.08-1.284-.176-1.848H12.24z"/>
            </svg>
            <span>Continuar con Google</span>
          </button>

          <p className="text-center text-xs text-slate-500">
            {mode === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline bg-transparent border-none cursor-pointer"
            >
              {mode === 'login' ? 'Creá una gratis' : 'Iniciá sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
