/**
 * Diagnóstico de últimas transacciones con claves directas
 */
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = 'https://ebvwkprgmbzthrquqkpf.supabase.co';
  const key = 'sb_publishable_r35zf8Zthn-ZW4gWmnfpxw_PnHxXBJ0';
  
  const supabase = createClient(url, key);
  
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('📌 ÚLTIMAS TRANSACCIONES EN BD:');
  txs.forEach(tx => {
    console.log(`- ID: ${tx.id}\n  Desc: ${tx.description}\n  Monto: ${tx.amount}\n  Tipo: ${tx.type}\n  Status: ${tx.status}\n  Fecha Tx: ${tx.transaction_date}\n  Metadata: ${JSON.stringify(tx.ai_metadata)}\n  Account ID: ${tx.account_id}\n`);
  });
}

run();
