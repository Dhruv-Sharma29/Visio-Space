import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { profileService, type UserProfile, type UserPreferences } from '../services/profileService';
import { applyTheme, getStoredTheme, isThemeId } from '../utils/theme';

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  needsProfileOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; confirmationRequired: boolean }>;
  signUpWithProfile: (
    email: string,
    password: string,
    username: string,
    fullName: string
  ) => Promise<{ error: string | null; confirmationRequired: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  completeOnboarding: (
    username: string,
    fullName: string,
    avatarUrl?: string | null
  ) => Promise<{ error: string | null }>;
  updateProfile: (
    updates: Partial<Pick<UserProfile, 'username' | 'full_name' | 'avatar_url' | 'preferences'>>
  ) => Promise<{ error: string | null; profile?: UserProfile }>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfileOnboarding, setNeedsProfileOnboarding] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const p = await profileService.getProfile(userId);
      if (p && p.username) {
        setProfile(p);
        setNeedsProfileOnboarding(false);
        applyTheme(isThemeId(p.preferences?.theme) ? p.preferences.theme : getStoredTheme());
      } else {
        setProfile(null);
        setNeedsProfileOnboarding(true);
      }
    } catch {
      setProfile(null);
      setNeedsProfileOnboarding(true);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      applyTheme(getStoredTheme());
      setLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
        if (data.session?.user) {
          fetchProfile(data.session.user.id);
        } else {
          applyTheme(getStoredTheme());
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user) {
        fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setNeedsProfileOnboarding(false);
        applyTheme(getStoredTheme());
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    profile,
    profileLoading,
    needsProfileOnboarding,
    signIn: async (email, password) => {
      if (!supabase) return { error: 'Supabase is not configured. Add VITE_SUPABASE_ANON_KEY to .env.' };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data?.user) {
        await fetchProfile(data.user.id);
      }
      return { error: error?.message ?? null };
    },
    signUp: async (email, password) => {
      if (!supabase) return { error: 'Supabase is not configured. Add VITE_SUPABASE_ANON_KEY to .env.', confirmationRequired: false };
      const { data, error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null, confirmationRequired: Boolean(data.user && !data.session) };
    },
    signUpWithProfile: async (email, password, username, fullName) => {
      if (!supabase) return { error: 'Supabase is not configured. Add VITE_SUPABASE_ANON_KEY to .env.', confirmationRequired: false };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
          },
        },
      });

      if (error) {
        return { error: error.message, confirmationRequired: false };
      }

      if (data.user) {
        try {
          const newProfile = await profileService.createProfile({
            id: data.user.id,
            username,
            full_name: fullName,
          });
          setProfile(newProfile);
          setNeedsProfileOnboarding(false);
        } catch {
          // Trigger might have handled it or will be handled on login
        }
      }

      return {
        error: null,
        confirmationRequired: Boolean(data.user && !data.session),
      };
    },
    signInWithGoogle: async () => {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      return { error: error?.message ?? null };
    },
    signInWithApple: async () => {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });
      return { error: error?.message ?? null };
    },
    completeOnboarding: async (username, fullName, avatarUrl) => {
      const currentUserId = session?.user?.id;
      if (!currentUserId) return { error: 'You must be signed in to complete profile onboarding.' };

      try {
        const created = await profileService.createProfile({
          id: currentUserId,
          username,
          full_name: fullName,
          avatar_url: avatarUrl || (session?.user?.user_metadata?.avatar_url ?? null),
        });
        setProfile(created);
        setNeedsProfileOnboarding(false);
        return { error: null };
      } catch (err) {
        return { error: (err as Error).message || 'Failed to complete profile.' };
      }
    },
    updateProfile: async updates => {
      const currentUserId = session?.user?.id;
      if (!currentUserId) return { error: 'You must be signed in to update your profile.' };

      try {
        const updated = await profileService.updateProfile(currentUserId, updates);
        setProfile(updated);
        if (isThemeId(updated.preferences?.theme)) {
          applyTheme(updated.preferences.theme);
        }
        return { error: null, profile: updated };
      } catch (err) {
        return { error: (err as Error).message || 'Failed to update profile.' };
      }
    },
    refreshProfile: async () => {
      if (session?.user?.id) {
        await fetchProfile(session.user.id);
      }
    },
    resetPassword: async email => {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      setProfile(null);
      setNeedsProfileOnboarding(false);
      if (!supabase) return { error: null };
      const { error } = await supabase.auth.signOut();
      return { error: error?.message ?? null };
    },
  }), [loading, session, profile, profileLoading, needsProfileOnboarding, fetchProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
export type { UserProfile, UserPreferences };

