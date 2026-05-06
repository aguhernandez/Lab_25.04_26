import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
const hubAnonKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

export const hubClient = (hubUrl && hubAnonKey && hubUrl !== supabaseUrl)
  ? createClient(hubUrl, hubAnonKey)
  : null;
