import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh';

const PROFILE_STORAGE_KEY = 'lhoxtencer-auth-profile';

// Module-level guard to prevent double listener registration (HMR, React StrictMode edge cases)
let authListenerRegistered = false;

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
  const currentUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

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
    // Guard against double listener registration (HMR, React StrictMode edge cases)
    if (authListenerRegistered) {
      // Prevent double registration, but still sync session state
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
      return;
    }
    authListenerRegistered = true;

    // Step 1: Register listener FIRST (Supabase official guidance to prevent missed events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`[auth] event: ${event}`, session?.user?.id ?? 'no user');

        // Skip INITIAL_SESSION — getSession() below handles the initial state
        if (event === 'INITIAL_SESSION') return;

        // Synchronous state updates ONLY — safe inside the auth lock context
        setSession(session);
        setUser(session?.user ?? null);
        currentUserIdRef.current = session?.user?.id ?? null;

        if (!session?.user) {
          persistProfile(null);
          setLoading(false);
          return;
        }

        if (!initializedRef.current) {
          // Still bootstrapping — getSession().then() below handles profile fetch
          return;
        }

        // Restore cached profile immediately (synchronous, no Supabase call)
        const cachedProfile = restoreProfile(session.user.id);
        if (cachedProfile) {
          persistProfile(cachedProfile);
        }

        // Defer ALL Supabase calls until AFTER the auth lock releases
        const userId = session.user.id;
        setTimeout(() => {
          if (currentUserIdRef.current !== userId) return; // User signed out
          fetchProfile(userId).catch(error => {
            console.error('[auth] Failed to refresh profile after auth state change', error);
          });
        }, 0);
      }
    );

    // Step 2: Bootstrap session AFTER listener is registered (prevents missed events)
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        console.log('[auth] getSession resolved', session?.user?.id ?? 'no session');
        setSession(session);
        setUser(session?.user ?? null);
        currentUserIdRef.current = session?.user?.id ?? null;

        if (session?.user) {
          const cachedProfile = restoreProfile(session.user.id);
          if (cachedProfile) {
            persistProfile(cachedProfile);
          }

          try {
            await fetchProfile(session.user.id);
          } catch (error) {
            console.error('[auth] Failed to load profile during session bootstrap', error);
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
        initializedRef.current = true;
      });

    return () => {
      authListenerRegistered = false;
      subscription.unsubscribe();
    };
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
