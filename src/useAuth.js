import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { getTrialStatus } from './plans.js';

// Hook centralizado de sesión: escucha el login de Firebase y sincroniza el perfil
// del usuario en Firestore (users/{uid}). A un usuario nuevo se le crea el perfil
// con plan "trial" apenas inicia sesión por primera vez (login común o Google).
//
// Importante: el perfil (y con él, el arranque del trial) recién se crea si el
// correo está verificado. Si no lo creáramos antes de verificar, cualquiera
// podría registrarse con el correo de otra persona y "ocuparlo" para robarle
// una activación de plan pago (ver mercadoPagoWebhook, que matchea por correo).
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const unsubProfileRef = useRef(null);

  const ensureProfile = useCallback(async (currentUser) => {
    if (unsubProfileRef.current) {
      unsubProfileRef.current();
      unsubProfileRef.current = null;
    }

    if (!currentUser || !currentUser.emailVerified) {
      // Sin sesión, o cuenta creada pero todavía sin confirmar el correo.
      setProfile(null);
      setAuthLoading(false);
      return;
    }

    const profileRef = doc(db, 'users', currentUser.uid);
    try {
      const snap = await getDoc(profileRef);
      if (!snap.exists()) {
        await setDoc(profileRef, {
          email: currentUser.email || null,
          displayName: currentUser.displayName || null,
          plan: 'trial',
          trialStartedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('No se pudo leer/crear el perfil de Firestore: ', err);
    }

    unsubProfileRef.current = onSnapshot(profileRef, (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
      setAuthLoading(false);
    }, (err) => {
      console.error('Error escuchando el perfil de Firestore: ', err);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      ensureProfile(currentUser);
    });

    return () => {
      unsubAuth();
      if (unsubProfileRef.current) unsubProfileRef.current();
    };
  }, [ensureProfile]);

  // Firebase no avisa solo cuando se verifica el correo (el link se abre en otra
  // pestaña/dispositivo): hay que refrescar el usuario a mano para enterarnos, y
  // desde ahí recién intentar crear el perfil si ya está verificado.
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser({ ...refreshed });
    await ensureProfile(refreshed);
  }, [ensureProfile]);

  const trial = getTrialStatus(profile);

  return { user, profile, authLoading, trial, refreshUser };
}
