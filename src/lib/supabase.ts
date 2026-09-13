import { createClient } from '@supabase/supabase-js';

const globalProc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
const env = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env) || globalProc?.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
