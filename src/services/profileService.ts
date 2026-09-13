import { supabase } from '../lib/supabase';
import { cleanUsername, validateUsernameFormat } from '../utils/profileValidation';

export interface UserPreferences {
  theme?: 'dark-paper' | 'parchment-light' | 'high-contrast';
  sound?: boolean;
  snapToGrid?: boolean;
  defaultWorkspaceId?: string;
  notifyMentions?: boolean;
  notifyInvites?: boolean;
  notifyUpdates?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  preferences?: UserPreferences;
  created_at?: string;
  updated_at?: string;
}

const LOCAL_PROFILES_KEY = 'visiospace_local_profiles';

function getLocalProfiles(): Record<string, UserProfile> {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveLocalProfile(profile: UserProfile) {
  try {
    const map = getLocalProfiles();
    map[profile.id] = profile;
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(map));
  } catch {}
}

export const profileService = {
  /**
   * Fetch user profile by Auth user ID
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;

    if (!supabase) {
      return getLocalProfiles()[userId] || null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // Table might not exist or relation error -> fallback to local
        if (error.code === 'PGRST205' || error.message.includes('relation') || error.code === '42P01') {
          return getLocalProfiles()[userId] || null;
        }
        throw new Error(error.message);
      }

      if (!data) {
        return getLocalProfiles()[userId] || null;
      }

      const profile: UserProfile = {
        id: data.id,
        username: data.username || '',
        full_name: data.full_name || data.display_name || '',
        avatar_url: data.avatar_url,
        preferences: data.preferences || {},
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      saveLocalProfile(profile);
      return profile;
    } catch {
      return getLocalProfiles()[userId] || null;
    }
  },

  /**
   * Check if a username is available across all registered profiles (case-insensitive)
   */
  async checkUsernameAvailability(
    username: string,
    currentUserId?: string
  ): Promise<{ available: boolean; error?: string }> {
    const cleaned = cleanUsername(username);
    const formatCheck = validateUsernameFormat(cleaned);
    if (!formatCheck.valid) {
      return { available: false, error: formatCheck.error };
    }

    if (!supabase) {
      // Local check
      const profiles = Object.values(getLocalProfiles());
      const taken = profiles.some(
        p => p.username.toLowerCase() === cleaned.toLowerCase() && p.id !== currentUserId
      );
      if (taken) {
        return { available: false, error: 'Username is already taken.' };
      }
      return { available: true };
    }

    try {
      // 1. Try secure RPC function
      const { data: isAvailable, error: rpcError } = await supabase.rpc('is_username_available', {
        check_username: cleaned,
        current_user_id: currentUserId || null,
      });

      if (!rpcError && typeof isAvailable === 'boolean') {
        return {
          available: isAvailable,
          error: isAvailable ? undefined : 'Username is already taken.',
        };
      }

      // 2. Direct query fallback if RPC function is not yet created
      const query = supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleaned)
        .limit(1);

      const { data, error } = await query;
      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('relation') || error.code === '42P01') {
          return { available: true };
        }
        return { available: false, error: error.message };
      }

      const match = data?.[0];
      if (match && match.id !== currentUserId) {
        return { available: false, error: 'Username is already taken.' };
      }

      return { available: true };
    } catch {
      return { available: true };
    }
  },

  /**
   * Create profile record for a new user
   */
  async createProfile(data: {
    id: string;
    username: string;
    full_name: string;
    avatar_url?: string | null;
    preferences?: UserPreferences;
  }): Promise<UserProfile> {
    const cleanedUsername = cleanUsername(data.username);
    const formatCheck = validateUsernameFormat(cleanedUsername);
    if (!formatCheck.valid) {
      throw new Error(formatCheck.error || 'Invalid username format.');
    }

    const availCheck = await this.checkUsernameAvailability(cleanedUsername, data.id);
    if (!availCheck.available) {
      throw new Error(availCheck.error || 'Username is already taken.');
    }

    const profile: UserProfile = {
      id: data.id,
      username: cleanedUsername,
      full_name: data.full_name.trim(),
      avatar_url: data.avatar_url || null,
      preferences: data.preferences || { theme: 'dark-paper', sound: true, snapToGrid: false },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!supabase) {
      saveLocalProfile(profile);
      return profile;
    }

    try {
      const { data: inserted, error } = await supabase
        .from('profiles')
        .insert({
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          preferences: profile.preferences,
        })
        .select()
        .single();

      if (error || !inserted) {
        if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
          throw new Error('This username is already taken. Please choose another.');
        }
        if (error?.code === 'PGRST205' || error?.message?.includes('relation')) {
          saveLocalProfile(profile);
          return profile;
        }
        throw new Error(error?.message || 'Failed to create profile.');
      }

      const res: UserProfile = {
        id: inserted.id,
        username: inserted.username,
        full_name: inserted.full_name,
        avatar_url: inserted.avatar_url,
        preferences: inserted.preferences,
        created_at: inserted.created_at,
        updated_at: inserted.updated_at,
      };
      saveLocalProfile(res);
      return res;
    } catch (err) {
      if ((err as Error).message.includes('already taken')) {
        throw err;
      }
      saveLocalProfile(profile);
      return profile;
    }
  },

  /**
   * Update profile fields (Full Name, Username, Avatar, Preferences)
   */
  async updateProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, 'username' | 'full_name' | 'avatar_url' | 'preferences'>>
  ): Promise<UserProfile> {
    if (!userId) throw new Error('User ID is required.');

    const current = (await this.getProfile(userId)) || {
      id: userId,
      username: '',
      full_name: '',
    };

    const nextUsername = updates.username !== undefined ? cleanUsername(updates.username) : current.username;

    if (updates.username !== undefined && nextUsername !== current.username) {
      const format = validateUsernameFormat(nextUsername);
      if (!format.valid) throw new Error(format.error || 'Invalid username format.');

      const avail = await this.checkUsernameAvailability(nextUsername, userId);
      if (!avail.available) throw new Error(avail.error || 'Username is already taken.');
    }

    const payload: Partial<UserProfile> = {
      ...updates,
      username: nextUsername,
      full_name: updates.full_name !== undefined ? updates.full_name.trim() : current.full_name,
      updated_at: new Date().toISOString(),
    };

    const updatedProfile: UserProfile = {
      ...current,
      ...payload,
      id: userId,
    };

    if (!supabase) {
      saveLocalProfile(updatedProfile);
      return updatedProfile;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: updatedProfile.username,
          full_name: updatedProfile.full_name,
          avatar_url: updatedProfile.avatar_url,
          preferences: updatedProfile.preferences,
          updated_at: updatedProfile.updated_at,
        })
        .eq('id', userId)
        .select()
        .single();

      if (error || !data) {
        if (error?.code === '23505' || error?.message?.includes('unique') || error?.message?.includes('duplicate')) {
          throw new Error('This username is already taken. Please choose another.');
        }
        saveLocalProfile(updatedProfile);
        return updatedProfile;
      }

      const res: UserProfile = {
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        preferences: data.preferences,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      saveLocalProfile(res);
      return res;
    } catch (err) {
      if ((err as Error).message.includes('already taken')) {
        throw err;
      }
      saveLocalProfile(updatedProfile);
      return updatedProfile;
    }
  },
};
