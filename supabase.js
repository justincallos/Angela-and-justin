import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sskndsmrtmdrzdllncmx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lc-oDVuoTaYPU0f-NJtWLg_puIYgu_N';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
