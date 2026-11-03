import { createClient } from '@supabase/supabase-js';
// Publishable key only; database policies enforce access, including Realtime.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://wfzdzhsxdqagckmzqnta.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_gi-Bs07AVSo-cLIpZ8Sztw_nyqdM1EJ',
);
