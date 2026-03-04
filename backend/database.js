const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Prefer server-side service role variables, but fall back to the public NEXT_PUBLIC_* vars
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase env vars missing. Expected SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY');
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
