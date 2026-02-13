const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('>> SUPABASE_CONFIG:', {
  url: supabaseUrl,
  keyLength: supabaseKey ? supabaseKey.length : 0
});

if (!supabaseUrl || !supabaseKey) {
  console.error('>> ERROR: Missing Supabase credentials in .env');
  console.error('>> URL:', supabaseUrl);
  console.error('>> KEY:', supabaseKey ? 'EXISTS' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

console.log('>> SUPABASE: Client initialized successfully');

module.exports = supabase;
