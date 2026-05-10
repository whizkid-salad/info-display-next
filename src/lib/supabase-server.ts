import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // 서버 사이드에서는 service role key 우선 (RLS 우회). 없으면 anon key로 폴백.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase URL or key not set');
  return createClient(url, key, { auth: { persistSession: false } });
}
