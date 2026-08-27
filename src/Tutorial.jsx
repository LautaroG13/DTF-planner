import React, { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    id: 'intro',
    target: null,
    title: '¡Bienvenido a ImProX! 👋',
    body: 'Te mostramos rápido cómo armar tu primera plancha de stickers. Podés saltear este recorrido cuando quieras y volver a verlo con el botón "❓ Tutorial" del header.',
  },
  {
    id: 'config-pelicula',
    target: 'config-pelicula',
    requiresConfigOpen: true,
    title: '1. Configurá tu película',
    body: 'Elegí el ancho y largo de tu bobina de film, el margen de seguridad y el espacio de corte entre stickers.',
  },
  {
    id: 'config-tematicas',
    target: 'config-tematicas',
    requiresConfigOpen: true,
    title: '2. Armá tus temáticas',
    body: 'Cada temática tiene su propio tamaño de "planchita". Los stickers de la misma temática se agrupan juntos automáticamente al armar la plancha.',
  },
  {
    id: 'subir-imagenes',
    target: 'subir-imagenes',
    title: '3. Subí tus diseños',
    body: 'Arrastrá muchas imágenes de una sola vez: se acomodan solas en la grilla de trabajo, no hace falta subirlas de a una.',
  },
  {
    id: 'grilla-stickers',
    target: 'grilla-stickers',
    title: '4. Editá cada sticker',
    body: 'Hacé click en cualquier sticker para recortarlo, quitarle el fondo, ponerle un borde, o cambiar su tamaño y cantidad de copias.',
  },
  {
    id: 'organizacion',
    target: 'organizacion',
    title: 'Organización de la plancha',
    body: 'Elegí si querés agrupar por temática (cada una en su propio bloque) o mezclar todo para aprovechar al máximo el film disponible.',
  },
  {
    id: 'lienzo',
    target: 'lienzo',
    title: 'Vista de la plancha',
    body: 'Acá ves el resultado del armado automático, con guías de corte y zoom. Si no entra todo en una plancha, se crean planchas adicionales solas.',
  },
  {
    id: 'generar-pdf',
    target: 'generar-pdf',
    title: 'Exportá tu plancha',
    body: 'Cuando esté todo listo, descargá el PDF final, listo para mandar a imprimir.',
  },
  {
    id: 'trial-counter',
    target: 'trial-counter',
    optional: true,
    title: 'Tu prueba gratis',
    body: 'Acá siempre vas a ver cuántos días te quedan de prueba gratis. Cuando se termine, vas a poder elegir un plan para seguir usando ImProX.',
  },
];

const TOOLTIP_WIDTH = 320;

export default function Tutorial({ onFinish, onBeforeStep }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const recomputeRect = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (onBeforeStep) onBeforeStep(step);
    // Pequeño delay: si este paso abrió un panel colapsado, dejamos que termine de renderizar antes de medirlo.
    const t = setTimeout(recomputeRect, 220);
    window.addEventListener('resize', recomputeRect);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', recomputeRect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const handleNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setStepIndex((i) => i + 1);
  };
  const handleBack = () => setStepIndex((i) => Math.max(0, i - 1));

  let tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  if (rect) {
    const maxLeft = Math.max(16, window.innerWidth - TOOLTIP_WIDTH - 16);
    const left = Math.min(Math.max(rect.left, 16), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > 240) {
      tooltipStyle = { top: rect.bottom + 16, left };
    } else {
      tooltipStyle = { top: Math.max(rect.top - 16, 16), left, transform: 'translateY(-100%)' };
    }
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {rect ? (
        <div
          className="fixed pointer-events-none rounded-lg transition-all duration-300"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.85)',
            border: '2px solid rgba(34, 211, 238, 0.8)',
          }}
        ></div>
      ) : (
        <div className="fixed inset-0 bg-slate-950/85"></div>
      )}

      <div
        className="fixed rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 z-[61] transition-all duration-300"
        style={{ width: TOOLTIP_WIDTH, ...tooltipStyle }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
            Paso {stepIndex + 1} de {STEPS.length}
          </span>
          <button onClick={onFinish} className="text-slate-500 hover:text-slate-200 bg-transparent border-none cursor-pointer text-sm leading-none">
            ✕
          </button>
        </div>
        <h3 className="text-sm font-black text-white mb-1.5">{step.title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">{step.body}</p>
        <div className="flex justify-between items-center gap-2">
          <button
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="text-xs font-bold text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer"
          >
            ← Atrás
          </button>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === stepIndex ? 'bg-cyan-400' : 'bg-slate-700'}`}></span>
            ))}
          </div>
          <button
            onClick={handleNext}
            className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white text-xs font-bold px-4 py-1.5 rounded-lg cursor-pointer"
          >
            {isLast ? 'Listo' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  );
}
