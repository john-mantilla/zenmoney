const { createClient } = require('@supabase/supabase-js');
const url = 'https://ebvwkprgmbzthrquqkpf.supabase.co';
const key = 'sb_publishable_r35zf8Zthn-ZW4gWmnfpxw_PnHxXBJ0';
const supabase = createClient(url, key);

async function run() {
  console.log('📌 ACCOUNTS (NO FILTERS):');
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('*');
  console.log('Accounts error:', accError);
  console.log(accounts);

  console.log('\n📌 TRANSACTIONS (NO FILTERS, last 20):');
  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log('Transactions error:', txError);
  console.log(txs);
}
run();
