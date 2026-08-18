import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { getTrialStatus } from './plans.js';

// Hook centralizado de sesión: escucha el login de Firebase y sincroniza el perfil
// del usuario en Firestore (users/{uid}). A un usuario nuevo se le crea el perfil
// con plan "trial" apenas inicia sesión por primera vez (login común o Google).
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      setUser(currentUser);

      if (!currentUser) {
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

      unsubProfile = onSnapshot(profileRef, (snap) => {
        setProfile(snap.exists() ? snap.data() : null);
        setAuthLoading(false);
      }, (err) => {
        console.error('Error escuchando el perfil de Firestore: ', err);
        setAuthLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const trial = getTrialStatus(profile);

  return { user, profile, authLoading, trial };
}
