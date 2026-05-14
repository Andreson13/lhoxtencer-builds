import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh';

const PROFILE_STORAGE_KEY = 'lhoxtencer-auth-profile';

export interface Profile {
  id: string;
  hotel_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_hotel_owner: boolean;
  is_super_admin: boolean;
  disabled: boolean;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const persistProfile = (value: Profile | null) => {
    setProfile(value);

    if (typeof window === 'undefined') {
      return;
    }

    if (!value) {
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(value));
  };

  const restoreProfile = (userId: string) => {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!rawProfile) {
      return null;
    }

    try {
      const cachedProfile = JSON.parse(rawProfile) as Profile;
      return cachedProfile.id === userId ? cachedProfile : null;
    } catch {
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
      return null;
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    if (data) {
      persistProfile(data as unknown as Profile);
    }
  };

  useEffect(() => {
    let initialized = false;

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const cachedProfile = restoreProfile(session.user.id);
          if (cachedProfile) {
            persistProfile(cachedProfile);
          }

          try {
            await fetchProfile(session.user.id);
          } catch (error) {
            console.error('Failed to load profile during session bootstrap', error);
            if (!cachedProfile) {
              persistProfile(null);
            }
          }
        } else {
          persistProfile(null);
        }
      })
      .finally(() => {
        setLoading(false);
        initialized = true;
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          persistProfile(null);
          setLoading(false);
          return;
        }

        if (!initialized) {
          return;
        }

        const cachedProfile = restoreProfile(session.user.id);
        if (cachedProfile) {
          persistProfile(cachedProfile);
        }

        try {
          await fetchProfile(session.user.id);
        } catch (error) {
          console.error('Failed to refresh profile after auth state change', error);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    persistProfile(null);
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      try {
        await fetchProfile(user.id);
      } catch (error) {
        // Silently ignore abort/lock errors from concurrent requests
        if (error instanceof Error) {
          if (error.message.includes('AbortError') || error.message.includes('Lock broken')) {
            console.debug('ℹ️  Database request aborted (overlapping refresh attempt)');
            return;
          }
        }
        console.error('Error refreshing profile:', error);
      }
    }
  }, [user]);

  // Refresh profile when app comes back into focus
  useVisibilityRefresh(refreshProfile);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
