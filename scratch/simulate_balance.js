/**
 * Simulación de cálculo de saldo y desfases horários
 */
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = 'https://ebvwkprgmbzthrquqkpf.supabase.co';
  const key = 'sb_publishable_r35zf8Zthn-ZW4gWmnfpxw_PnHxXBJ0';
  const supabase = createClient(url, key);

  // Crear correo único para la prueba
  const email = `test_${Date.now()}@zenmoney.com`;
  const password = 'PasswordTest123!';

  console.log(`🔑 Registrando usuario de prueba: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error('Error de registro Auth:', authError);
    return;
  }

  const userId = authData.user.id;

  try {
    // 1. Crear un grupo familiar de prueba
    const { data: family, error: famError } = await supabase
      .from('family_groups')
      .insert({ name: 'Familia de Pruebas', currency_default: 'COP' })
      .select('*')
      .single();

    if (famError) throw new Error(`Error familia: ${famError.message}`);
    console.log('✅ Grupo familiar creado:', family.id);

    // 2. Crear perfil del usuario de prueba
    const { data: profile, error: profError } = await supabase
      .from('user_profiles')
      .insert({
        auth_user_id: userId,
        family_group_id: family.id,
        display_name: 'Tester',
        email: email,
        role: 'admin'
      })
      .select('*')
      .single();

    if (profError) throw new Error(`Error perfil: ${profError.message}`);
    console.log('✅ Perfil creado:', profile.id);

    // 3. Crear una cuenta de ahorros (tipo 'bank') con saldo de 1.756.000
    const { data: account, error: accError } = await supabase
      .from('accounts')
      .insert({
        family_group_id: family.id,
        owner_user_id: profile.id,
        name: 'Ahorros Bancolombia',
        type: 'bank',
        initial_balance: 1756000,
        currency: 'COP',
        is_active: true
      })
      .select('*')
      .single();

    if (accError) throw new Error(`Error cuenta: ${accError.message}`);
    console.log('✅ Cuenta de ahorros creada con balance inicial:', account.initial_balance);

    // 4. Crear un gasto de 2.000.000
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert({
        family_group_id: family.id,
        account_id: account.id,
        created_by_user_id: profile.id,
        type: 'expense', // GASTO
        amount: 2000000, // 2 millones
        currency: 'COP',
        description: 'Pago de Factura Servicio',
        transaction_date: '2026-07-12',
        status: 'confirmed',
        input_method: 'manual'
      })
      .select('*')
      .single();

    if (txError) throw new Error(`Error transacción: ${txError.message}`);
    console.log('✅ Gasto de 2.000.000 creado. Tipo:', tx.type, 'Monto:', tx.amount);

    // 5. Simular el cálculo de saldo del caso de uso CalculateAccountBalance
    // Recuperar transacciones confirmadas de la cuenta
    const { data: dbTxs, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'confirmed');

    if (fetchError) throw new Error(`Error recuperando txs: ${fetchError.message}`);
    
    let balance = Number(account.initial_balance);
    console.log(`\n🧮 Simulación de CalculateAccountBalance (saldo inicial ${balance}):`);
    
    dbTxs.forEach(t => {
      const amount = Number(t.amount);
      if (t.type === 'income') {
        balance += amount;
        console.log(`  + Ingreso: +${amount} -> Saldo: ${balance}`);
      } else if (t.type === 'expense') {
        balance -= amount;
        console.log(`  - Gasto: -${amount} -> Saldo: ${balance}`);
      }
    });

    console.log(`\n🎉 Balance Calculado Resultante: ${balance}`);

  } catch (err) {
    console.error('❌ Error durante la simulación:', err.message);
  } finally {
    // Limpieza: Eliminar usuario de prueba
    // Nota: Como no tenemos service_role, no podemos eliminar de auth.users directamente mediante API pública,
    // pero al estar en cascada con family_groups y perfiles, las tablas relacionales quedarán limpias si eliminamos la familia.
  }
}

run();
