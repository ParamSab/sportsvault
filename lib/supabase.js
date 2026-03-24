import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _supabase = null;

export function getSupabase() {
    if (!supabaseUrl || !supabaseKey) {
        return null; // Supabase not configured
    }
    if (!_supabase) {
        _supabase = createClient(supabaseUrl, supabaseKey);
    }
    return _supabase;
}
