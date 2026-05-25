import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, requestNotificationPermission } from './firebase';

export type UserRole = 'superadmin' | 'admin' | 'rh' | 'medico' | 'colaborador';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string; // Multi-tenant ID
  matricula?: string;
  setor?: string;
  cargo?: string;
  pushToken?: string;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let currentProfile: UserProfile;
          if (userDoc.exists()) {
            currentProfile = userDoc.data() as UserProfile;
            let needsUpdate = false;
            let updates: any = {};

            // Migração silenciosa para usuários antigos que não tem companyId
            if (!currentProfile.companyId) {
              currentProfile.companyId = 'DEFAULT_COMPANY';
              updates.companyId = 'DEFAULT_COMPANY';
              needsUpdate = true;
            }

            // Garante que seu e-mail seja marcado como superadmin se tiver se cadastrado antes
            if (firebaseUser.email === 'xellfernandes@gmail.com' && currentProfile.role !== 'superadmin') {
              currentProfile.role = 'superadmin';
              updates.role = 'superadmin';
              needsUpdate = true;
            }

            if (needsUpdate) {
              await updateDoc(userDocRef, updates);
            }

            setProfile(currentProfile);
          } else {
            // Handle new user creation with possible invitation
            let assignedRole: UserRole = 'colaborador';
            let assignedCompanyId = 'DEFAULT_COMPANY';

            if (firebaseUser.email) {
              const inviteRef = doc(db, 'invites', firebaseUser.email.toLowerCase());
              const inviteSnap = await getDoc(inviteRef);
              
              if (inviteSnap.exists()) {
                const inviteData = inviteSnap.data();
                assignedRole = (inviteData.role as UserRole) || 'colaborador';
                assignedCompanyId = inviteData.companyId || 'DEFAULT_COMPANY';
                // Remove invite document as it's been used
                await deleteDoc(inviteRef);
              }
            }

            // If it's the specific admin email, set as superadmin
            if (firebaseUser.email === 'xellfernandes@gmail.com' && firebaseUser.emailVerified) {
              assignedRole = 'superadmin';
            }

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuário',
              email: firebaseUser.email || '',
              role: assignedRole,
              companyId: assignedCompanyId,
              createdAt: serverTimestamp(),
            };
            
            await setDoc(userDocRef, newProfile);
            currentProfile = newProfile;
            setProfile(newProfile);
          }

          // Request notification permission and update token
          const token = await requestNotificationPermission();
          if (token && token !== currentProfile.pushToken) {
            await updateDoc(userDocRef, { pushToken: token });
            setProfile(prev => prev ? { ...prev, pushToken: token } : null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
