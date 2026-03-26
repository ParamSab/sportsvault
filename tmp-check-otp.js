const { getSupabase } = require('./lib/supabase');

async function checkOtp() {
    const supabase = getSupabase();
    if (!supabase) {
        console.error('Supabase not configured');
        return;
    }
    const { data, error } = await supabase.from('otp_codes').select('*').order('created_at', { ascending: false }).limit(5);
    if (error) {
        console.error('Error fetching OTP codes:', error);
    } else {
        console.log('Recent OTP codes:', data);
    }
}

checkOtp();
