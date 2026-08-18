import React from 'react';

export default function TrialExpired({ user, onLogout, onGoToPricing }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center gap-4 shadow-2xl">
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl">
          ⏳
        </div>
        <h1 className="text-xl font-black text-white">Tu prueba gratis de 7 días terminó</h1>
        <p className="text-sm text-slate-400">
          {user?.displayName ? `${user.displayName}, ya` : 'Ya'} usaste los 7 días de acceso completo a ImProX.
          Para seguir armando planchas, elegí un plan.
        </p>
        <button
          onClick={onGoToPricing}
          className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-extrabold py-3 rounded-xl text-sm transition-all active:scale-95 cursor-pointer"
        >
          Ver planes y precios
        </button>
        <button
          onClick={onLogout}
          className="text-xs text-slate-500 hover:text-slate-300 underline bg-transparent border-none cursor-pointer"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
