import { StrictMode, useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { signOut } from 'firebase/auth'
import './index.css'
import App from './App.jsx'
import Landing from './Landing.jsx'
import AuthModal from './AuthModal.jsx'
import TrialExpired from './TrialExpired.jsx'
import VerifyEmail from './VerifyEmail.jsx'
import { useAuth } from './useAuth.js'
import { auth } from './firebase.js'
import { initGoogleAnalytics, trackPageview } from './analytics.js'

initGoogleAnalytics();

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-slate-700 border-t-cyan-400 rounded-full animate-spin"></div>
    </div>
  );
}

// Ruteo mínimo sin dependencias: "/" muestra la landing, "/app" la herramienta
// (solo si hay sesión activa y la prueba gratis no venció).
function Root() {
  const [path, setPath] = useState(window.location.pathname);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, profile, authLoading, trial, refreshUser } = useAuth();

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo(0, 0);
    trackPageview(to);
  }, []);

  // Nadie entra a "/app" sin sesión: lo mandamos de vuelta a la landing con el login abierto.
  useEffect(() => {
    if (!authLoading && path.startsWith('/app') && !user) {
      window.history.replaceState({}, '', '/');
      setPath('/');
      setAuthModalOpen(true);
    }
  }, [authLoading, path, user]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error al cerrar sesión: ', err);
    }
    navigate('/');
  }, [navigate]);

  // "Probar gratis": si ya hay sesión entra directo, si no abre el login (común + Google).
  const handleEnterApp = useCallback(() => {
    if (user) {
      navigate('/app');
    } else {
      setAuthModalOpen(true);
    }
  }, [user, navigate]);

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false);
    navigate('/app');
  }, [navigate]);

  const goToPricing = useCallback(() => {
    navigate('/');
    setTimeout(() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [navigate]);

  // Cuenta creada pero correo sin confirmar: no la dejamos usar nada (ni la
  // landing con sesión "activa") hasta que verifique. Google ya viene siempre
  // verificado, así que esto solo frena el registro por correo/contraseña.
  if (user && !user.emailVerified) {
    return <VerifyEmail user={user} onCheckAgain={refreshUser} />;
  }

  if (path.startsWith('/app')) {
    if (authLoading || !user) return <LoadingScreen />;
    if (trial.isTrial && trial.isExpired) {
      return <TrialExpired user={user} onLogout={handleLogout} onGoToPricing={goToPricing} />;
    }
    return (
      <App
        user={user}
        profile={profile}
        trial={trial}
        onBackToLanding={() => navigate('/')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <>
      <Landing user={user} onEnterApp={handleEnterApp} />
      {authModalOpen && (
        <AuthModal onClose={() => setAuthModalOpen(false)} onSuccess={handleAuthSuccess} />
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
    <Analytics />
  </StrictMode>,
)
