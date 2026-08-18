import React, { useState, useMemo } from 'react';
import { PLANS, TRIAL_DAYS } from './plans.js';

// Separación honesta: lo que la herramienta ya hace hoy vs. lo que todavía está en desarrollo.
const FEATURES_LIVE = [
  { title: 'Anidado inteligente de planchas', desc: 'Acomoda tus stickers solo, por temática o mezclado para aprovechar al máximo cada metro de film.' },
  { title: 'Múltiples hojas automáticas', desc: 'Si no entra todo en una plancha, arma las que hagan falta sin que tengas que calcular nada.' },
  { title: 'Subida masiva de imágenes', desc: 'Arrastrá muchas fotos de una y se ordenan solas en la grilla de trabajo.' },
  { title: 'Eliminar fondo en un clic', desc: 'Modo "bordes conectados" que protege detalles internos, autodetección de color y cuentagotas.' },
  { title: 'Borde de sticker configurable', desc: 'Contorno grueso, parejo y sin huecos, sin perder resolución del diseño original.' },
  { title: 'Recorte y redimensionado', desc: 'Ajustá cada diseño a la medida exacta o a la medida de tu temática.' },
  { title: 'Exportación a PDF', desc: 'Descargá la plancha lista para mandar a imprimir, con guías de corte opcionales.' },
  { title: 'Calculadora de costos', desc: 'Estimá metros de film y costo por plancha antes de imprimir.' },
];

const FEATURES_SOON = [
  'Exportación TIFF lista para producción (CMYK + color directo)',
  'PDF vectorial con colores directos (spot colors)',
  'Motor de mediotonos (halftone) y dithering',
  'Controles de brillo, contraste y nitidez',
  'Rotar imágenes dentro del editor',
  'Generación de base blanca y trazados vectoriales',
  'Compatibilidad certificada con tu RIP y cortadora',
  'Login con Google y control de descargas por plan',
];

const formatARS = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

function Navbar({ user, onEnterApp }) {
  return (
    <nav className="sticky top-0 z-40 backdrop-blur bg-slate-950/80 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-violet-600 to-cyan-500 p-2 rounded-lg shadow-inner">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-black tracking-tight text-white">ImProX</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400 font-medium">
          <a href="#funciones" className="hover:text-white transition-colors">Funciones</a>
          <a href="#calculadora" className="hover:text-white transition-colors">Calculadora</a>
          <a href="#planes" className="hover:text-white transition-colors">Planes</a>
          <a href="#faq" className="hover:text-white transition-colors">Preguntas</a>
        </div>
        <button
          onClick={onEnterApp}
          className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          {user ? 'Ir a la herramienta' : 'Iniciar sesión'}
        </button>
      </div>
    </nav>
  );
}

function Hero({ user, onEnterApp }) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(139,92,246,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.2), transparent 40%)' }}
      ></div>
      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 text-center flex flex-col items-center">
        <span className="inline-flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1 text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          Hecho para talleres de DTF / UV
        </span>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-[1.05] max-w-3xl">
          Armá tus planchas de stickers en minutos, no en horas.
        </h1>
        <p className="mt-6 text-base md:text-lg text-slate-400 max-w-2xl">
          Subí todos tus diseños de una, dejá que se acomoden solos, sacale el fondo y ponele
          borde a cada sticker, y exportá el PDF listo para imprimir. Menos film desperdiciado,
          menos tiempo armando planchas a mano.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onEnterApp}
            className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-extrabold px-7 py-3.5 rounded-2xl shadow-xl transition-all active:scale-95 cursor-pointer"
          >
            {user ? 'Ir a la herramienta' : 'Probar gratis ahora'}
          </button>
          <a
            href="#planes"
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold px-7 py-3.5 rounded-2xl transition-all cursor-pointer"
          >
            Ver planes desde $2.000/mes
          </a>
        </div>
        <p className="mt-4 text-[11px] text-slate-500">
          {user ? `Ya tenés sesión iniciada.` : `${TRIAL_DAYS} días de prueba gratis. Después, suscripción vía Mercado Pago.`}
        </p>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="funciones" className="max-w-6xl mx-auto px-6 py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-2xl md:text-3xl font-black text-white">Todo lo que necesitás para armar una plancha</h2>
        <p className="mt-3 text-slate-400 text-sm md:text-base">
          Estas son las funciones que ya podés usar hoy. Somos transparentes: lo que todavía
          estamos construyendo lo marcamos aparte, sin prometer nada que no esté listo.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
        {FEATURES_LIVE.map((f) => (
          <div key={f.title} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2">
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black mb-1">✓</span>
            <h3 className="text-sm font-bold text-white">{f.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-1">
            🔜 Próximamente
          </span>
          <p className="text-xs text-slate-500">En desarrollo — todavía no disponibles en la herramienta.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5">
          {FEATURES_SOON.map((f) => (
            <div key={f} className="flex items-start gap-2 text-xs text-slate-500">
              <span className="mt-0.5">•</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Calculator() {
  const [filmPrice, setFilmPrice] = useState(12000);
  const [rollWidth, setRollWidth] = useState(58);
  const [designWidth, setDesignWidth] = useState(10);
  const [designHeight, setDesignHeight] = useState(10);
  const [quantity, setQuantity] = useState(50);
  const spacing = 0.5;

  const result = useMemo(() => {
    const w = Math.max(1, parseFloat(designWidth) || 1);
    const h = Math.max(1, parseFloat(designHeight) || 1);
    const roll = Math.max(1, parseFloat(rollWidth) || 1);
    const qty = Math.max(1, parseInt(quantity) || 1);
    const price = Math.max(0, parseFloat(filmPrice) || 0);

    const itemsPerRow = Math.max(1, Math.floor((roll + spacing) / (w + spacing)));
    const rows = Math.ceil(qty / itemsPerRow);
    const totalHeightCm = rows * (h + spacing);
    const metersNeeded = totalHeightCm / 100;
    const totalCost = metersNeeded * price;
    const costPerUnit = totalCost / qty;

    return { itemsPerRow, rows, metersNeeded, totalCost, costPerUnit };
  }, [filmPrice, rollWidth, designWidth, designHeight, quantity]);

  const Field = ({ label, value, onChange, suffix, min = 0, step = 1 }) => (
    <div>
      <label className="text-[11px] text-slate-400 font-semibold block mb-1">{label}</label>
      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-cyan-500">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-3 py-2 text-sm font-bold text-slate-100 focus:outline-none"
        />
        {suffix && <span className="pr-3 text-[11px] text-slate-500 font-mono">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <section id="calculadora" className="max-w-6xl mx-auto px-6 py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="text-2xl md:text-3xl font-black text-white">Calculadora rápida de costo DTF</h2>
        <p className="mt-3 text-slate-400 text-sm md:text-base">
          Estimación simple para hacerte una idea antes de imprimir. El cálculo real y optimizado
          (con anidado inteligente) lo hace la herramienta cuando entrás a ImProX.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 md:p-8">
        <div className="grid grid-cols-2 gap-4 content-start">
          <Field label="Precio del metro de film ($)" value={filmPrice} onChange={setFilmPrice} suffix="ARS" step={100} />
          <Field label="Ancho de bobina (cm)" value={rollWidth} onChange={setRollWidth} suffix="cm" />
          <Field label="Ancho del diseño (cm)" value={designWidth} onChange={setDesignWidth} suffix="cm" step={0.5} />
          <Field label="Alto del diseño (cm)" value={designHeight} onChange={setDesignHeight} suffix="cm" step={0.5} />
          <div className="col-span-2">
            <Field label="Cantidad de diseños" value={quantity} onChange={setQuantity} suffix="unidades" />
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center gap-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Diseños por fila</span>
            <span className="font-mono font-bold text-slate-200">{result.itemsPerRow}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Filas necesarias</span>
            <span className="font-mono font-bold text-slate-200">{result.rows}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Metros de film estimados</span>
            <span className="font-mono font-bold text-cyan-400">{result.metersNeeded.toFixed(2)} m</span>
          </div>
          <div className="h-px bg-slate-800 my-1"></div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-semibold text-sm">Costo total estimado</span>
            <span className="font-mono font-black text-white text-lg">${formatARS(result.totalCost)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-xs">Costo por unidad</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">${formatARS(result.costPerUnit)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection({ onEnterApp }) {
  const [notice, setNotice] = useState(null);

  const handleSubscribe = (plan) => {
    setNotice(plan.id);
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <section id="planes" className="max-w-6xl mx-auto px-6 py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-2xl md:text-3xl font-black text-white">Planes simples, sin letra chica</h2>
        <p className="mt-3 text-slate-400 text-sm md:text-base">
          Precio de lanzamiento por tiempo limitado. Todos los planes incluyen el mismo motor de
          armado automático de planchas.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-3xl p-6 flex flex-col gap-5 border ${
              plan.highlight
                ? 'bg-gradient-to-b from-violet-950/60 to-slate-900 border-violet-500/60 shadow-2xl shadow-violet-950/40 md:-translate-y-2'
                : 'bg-slate-900/50 border-slate-800'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                Más elegido
              </span>
            )}
            <div>
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">{plan.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{plan.tagline}</p>
            </div>

            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white">${formatARS(plan.price)}</span>
              <span className="text-xs text-slate-500 mb-1">/mes</span>
              <span className="text-xs text-slate-600 line-through mb-1">${formatARS(plan.oldPrice)}</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-cyan-300">
              {plan.downloadLimit}
            </div>

            <ul className="flex flex-col gap-2.5 text-xs text-slate-300 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-black mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan)}
              className={`w-full py-3 rounded-xl text-sm font-extrabold transition-all active:scale-95 cursor-pointer ${
                plan.highlight
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-lg'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700'
              }`}
            >
              Suscribirme
            </button>
            {notice === plan.id && (
              <p className="text-[11px] text-center text-amber-300 -mt-2 animate-fade-in">
                🚀 Muy pronto vas a poder pagar acá con Mercado Pago. ¡Gracias por la paciencia!
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-500 mt-8">
        ¿Ya tenés cuenta en ImProX?{' '}
        <button onClick={onEnterApp} className="text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer">
          Entrá acá
        </button>
      </p>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    { q: '¿Necesito crear una cuenta?', a: `Sí. Iniciás sesión con tu correo o con Google, y arrancás automáticamente con ${TRIAL_DAYS} días de prueba gratis con acceso completo a la herramienta.` },
    { q: '¿Qué pasa cuando se termina la prueba gratis?', a: 'Se bloquea el acceso a la herramienta hasta que te suscribas a alguno de los planes. Tu cuenta y tu sesión no se pierden.' },
    { q: '¿Necesito instalar algo?', a: 'No, ImProX funciona desde el navegador. Subís tus imágenes y trabajás directo desde ahí.' },
    { q: '¿Qué pasa si me quedo sin descargas en el mes?', a: 'Podés esperar al siguiente ciclo o pasarte a un plan superior en cualquier momento.' },
    { q: '¿Cómo pago?', a: 'Con Mercado Pago, con débito automático mensual. Podés cancelar cuando quieras.' },
  ];
  return (
    <section id="faq" className="max-w-3xl mx-auto px-6 py-16 md:py-20">
      <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-10">Preguntas frecuentes</h2>
      <div className="flex flex-col gap-3">
        {faqs.map((item) => (
          <details key={item.q} className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-5 open:border-slate-700">
            <summary className="flex justify-between items-center cursor-pointer text-sm font-bold text-slate-200 list-none">
              {item.q}
              <span className="text-slate-500 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
            </summary>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer({ onEnterApp }) {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-violet-600 to-cyan-500 p-1.5 rounded-lg">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-black text-white">ImProX</span>
          <span className="text-xs text-slate-600">— Planificador Inteligente DTF/UV</span>
        </div>
        <button onClick={onEnterApp} className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer">
          Entrar a la herramienta →
        </button>
      </div>
    </footer>
  );
}

export default function Landing({ user, onEnterApp }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      <Navbar user={user} onEnterApp={onEnterApp} />
      <Hero user={user} onEnterApp={onEnterApp} />
      <FeaturesSection />
      <Calculator />
      <PricingSection onEnterApp={onEnterApp} />
      <FAQSection />
      <Footer onEnterApp={onEnterApp} />
    </div>
  );
}
