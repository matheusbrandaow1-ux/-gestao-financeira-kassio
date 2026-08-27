import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  role: UserRole;
  clientId: string | null;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRoleState] = useState<UserRole>('CLIENT');
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Check active server-side session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && isMounted) {
            const u = data.user;
            const profile: UserProfile = {
              uid: u.id,
              email: u.email,
              name: u.name,
              displayName: u.displayName || u.name,
              role: u.role,
              clientId: u.role === 'CLIENT' ? 'kassio-pf' : (u.clientId || null),
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            setUserProfile(profile);
            setRoleState(u.role);
            setClientId(u.role === 'CLIENT' ? 'kassio-pf' : (u.clientId || null));
          }
        }
      } catch (err) {
        console.warn('Session check notice:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signInWithEmail = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        const u = data.user;
        const profile: UserProfile = {
          uid: u.id,
          email: u.email,
          name: u.name,
          displayName: u.displayName || u.name,
          role: u.role,
          clientId: u.role === 'CLIENT' ? 'kassio-pf' : (u.clientId || null),
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        setUserProfile(profile);
        setRoleState(u.role);
        setClientId(u.role === 'CLIENT' ? 'kassio-pf' : (u.clientId || null));
        return { success: true };
      } else {
        return { 
          success: false, 
          message: data.message || 'Email ou senha inválidos.' 
        };
      }
    } catch (err: any) {
      return { 
        success: false, 
        message: 'Email ou senha inválidos.' 
      };
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout notice:', err);
    } finally {
      setUserProfile(null);
      setRoleState('CLIENT');
      setClientId(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user: userProfile,
      loading,
      role,
      clientId,
      signInWithEmail,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
