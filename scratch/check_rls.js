const { createClient } = require('@supabase/supabase-js');
const url = 'https://ebvwkprgmbzthrquqkpf.supabase.co';
const key = 'sb_publishable_r35zf8Zthn-ZW4gWmnfpxw_PnHxXBJ0';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('user_profiles').select('*');
  console.log('Error:', error);
  console.log('Profiles:', data);
}
run();
