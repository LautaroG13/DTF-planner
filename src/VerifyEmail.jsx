import React, { useState } from 'react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from './firebase.js';

export default function VerifyEmail({ user, onCheckAgain }) {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  const handleResend = async () => {
    setSending(true);
    setMessage('');
    try {
      await sendEmailVerification(user, { url: 'https://improx.vercel.app/' });
      setMessage('Te reenviamos el correo de verificación.');
    } catch (err) {
      console.error('Error al reenviar la verificación: ', err);
      setMessage('No pudimos reenviar el correo. Probá de nuevo en un momento.');
    } finally {
      setSending(false);
    }
  };

  const handleCheckAgain = async () => {
    setChecking(true);
    setMessage('');
    try {
      await onCheckAgain();
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center gap-4 shadow-2xl">
        <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl">
          ✉️
        </div>
        <h1 className="text-xl font-black text-white">Confirmá tu correo</h1>
        <p className="text-sm text-slate-400">
          Te mandamos un link de verificación a{' '}
          <strong className="text-slate-200">{user?.email}</strong>. Abrilo para
          activar tu cuenta y arrancar tu prueba gratis de 7 días.
        </p>

        {message && <p className="text-xs text-cyan-300">{message}</p>}

        <button
          onClick={handleCheckAgain}
          disabled={checking}
          className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-sm transition-all active:scale-95 cursor-pointer"
        >
          {checking ? 'Comprobando...' : 'Ya verifiqué, continuar'}
        </button>
        <button
          onClick={handleResend}
          disabled={sending}
          className="text-xs text-slate-400 hover:text-slate-200 underline bg-transparent border-none cursor-pointer disabled:opacity-50"
        >
          {sending ? 'Enviando...' : 'Reenviar correo de verificación'}
        </button>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-600 hover:text-slate-400 underline bg-transparent border-none cursor-pointer"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
