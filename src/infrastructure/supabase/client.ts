/**
 * ZenMoney — Supabase Client Configuration
 *
 * Initializes the Supabase client with the project URL and anon key.
 * These values should be set via environment variables.
 *
 * For local development, use `supabase start` and the local URL/key.
 * For production, use the Supabase Cloud project URL/key.
 */
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[ZenMoney] Supabase URL or Anon Key not configured. ' +
    'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage for session persistence on mobile
    // On web, it defaults to localStorage
    ...(Platform.OS !== 'web' && {
      storage: AsyncStorage,
    }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
