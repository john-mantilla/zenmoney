/**
 * ZenMoney — Importador Inteligente de CSV
 *
 * Lee el archivo Report.csv, extrae las transacciones, crea de forma automática
 * las cuentas, categorías y subcategorías faltantes en Supabase, e inserta
 * los registros vinculados a tu usuarioJohn y grupo familiar.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Cargar configuración del .env
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: No se encontró el archivo .env en la raíz.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').trim();
  }
});

const supabaseUrl = envVars['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Credenciales de Supabase no definidas en el .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Ruta del CSV
const csvPath = 'D:\\Documentos\\Iniciativas\\FinanzasPersonales\\Report.csv';

// Parser manual simple de CSV que soporta comillas y comas internas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(val => val.replace(/^"|"$/g, '').trim()); // Quitar comillas remanentes
}

async function startImport() {
  console.log('--- INICIANDO IMPORTACIÓN DE GASTOS REALES ---');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: No se encontró el archivo CSV en ${csvPath}`);
    return;
  }

  // 3. Obtener el perfil del primer usuario registrado (John) para vincular los datos
  const { data: profiles, error: profileErr } = await supabase
    .from('user_profiles')
    .select('id, family_group_id')
    .limit(1);

  if (profileErr || !profiles || profiles.length === 0) {
    console.error('Error: No se encontró ningún perfil de usuario en la base de datos de Supabase. Registra un usuario en la app antes de correr la importación.');
    return;
  }

  const userId = profiles[0].id;
  const familyGroupId = profiles[0].family_group_id;
  console.log(`Viculando datos al usuario ID: ${userId} de la familia: ${familyGroupId}`);

  // Cargar cuentas y categorías existentes para evitar duplicados en memoria
  const { data: existingAccounts } = await supabase.from('accounts').select('id, name');
  const accountMap = new Map(existingAccounts?.map(a => [a.name.toLowerCase(), a.id]) || []);

  const { data: existingCategories } = await supabase.from('categories').select('id, name, parent_category_id');
  const categoryMap = new Map(existingCategories?.map(c => [c.name.toLowerCase(), c]) || []);

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  // Ignorar cabecera
  const dataLines = lines.slice(1);
  console.log(`Líneas a procesar: ${dataLines.length}`);

  let importedCount = 0;

  for (const line of dataLines) {
    const columns = parseCSVLine(line);
    if (columns.length < 5) continue;

    const [dateStr, categoryStr, subCategoryStr, amountStr, accountStr, payeeStr, notesStr] = columns;

    // A. Parsear Monto
    // Convertir " 1845000,00" -> 1845000
    const cleanAmountStr = amountStr.replace(/\s/g, '').split(',')[0];
    const amount = parseInt(cleanAmountStr, 10);
    if (isNaN(amount) || amount <= 0) continue;

    // B. Obtener o Crear Cuenta de forma automática
    let accountId = accountMap.get(accountStr.toLowerCase());
    if (!accountId) {
      console.log(`Creando nueva cuenta financiera: ${accountStr}`);
      // Determinar el tipo de cuenta según el nombre
      let type = 'bank';
      if (accountStr.toLowerCase().includes('efectivo') || accountStr.toLowerCase().includes('vale')) {
        type = 'cash';
      } else if (['nu', 'rappicard', 'visa', 'mastercard', 'crédito'].some(w => accountStr.toLowerCase().includes(w))) {
        type = 'credit_card';
      }

      const { data: newAcc, error: accErr } = await supabase
        .from('accounts')
        .insert({
          family_group_id: familyGroupId,
          owner_user_id: userId,
          name: accountStr,
          type,
          initial_balance: 0, // Inicia en 0, los movimientos definirán el saldo
          currency: 'COP',
          is_active: true,
        })
        .select('id')
        .single();

      if (accErr || !newAcc) {
        console.error(`Error al crear la cuenta ${accountStr}:`, accErr?.message);
        continue;
      }
      accountId = newAcc.id;
      accountMap.set(accountStr.toLowerCase(), accountId);
    }

    // C. Obtener o Crear Categoría Principal (Nivel 1)
    let parentCategory = categoryMap.get(categoryStr.toLowerCase());
    if (!parentCategory) {
      console.log(`Creando categoría principal: ${categoryStr}`);
      const { data: newCat, error: catErr } = await supabase
        .from('categories')
        .insert({
          family_group_id: familyGroupId,
          name: categoryStr,
          icon: 'tag',
          color: '#4CAF50',
          is_system: false,
          is_private: false,
        })
        .select('*')
        .single();

      if (catErr || !newCat) {
        console.error(`Error al crear la categoría ${categoryStr}:`, catErr?.message);
        continue;
      }
      parentCategory = newCat;
      categoryMap.set(categoryStr.toLowerCase(), parentCategory);
    }

    // D. Obtener o Crear Subcategoría (Nivel 2)
    let finalCategoryId = parentCategory.id;
    if (subCategoryStr && subCategoryStr.trim().length > 0) {
      const subCategoryKey = `${categoryStr.toLowerCase()} > ${subCategoryStr.toLowerCase()}`;
      let subCategory = categoryMap.get(subCategoryKey);
      
      if (!subCategory) {
        console.log(`Creando subcategoría: ${categoryStr} -> ${subCategoryStr}`);
        const { data: newSubCat, error: subCatErr } = await supabase
          .from('categories')
          .insert({
            family_group_id: familyGroupId,
            name: subCategoryStr,
            icon: 'subdirectory-arrow-right',
            color: '#81C784',
            parent_category_id: parentCategory.id,
            is_system: false,
            is_private: false,
          })
          .select('*')
          .single();

        if (subCatErr || !newSubCat) {
          console.error(`Error al crear la subcategoría ${subCategoryStr}:`, subCatErr?.message);
          // Fallback a usar la categoría padre si la subcategoría falla
        } else {
          subCategory = newSubCat;
          categoryMap.set(subCategoryKey, subCategory);
          finalCategoryId = subCategory.id;
        }
      } else {
        finalCategoryId = subCategory.id;
      }
    }

    // E. Crear la Transacción
    const { error: txErr } = await supabase
      .from('transactions')
      .insert({
        family_group_id: familyGroupId,
        account_id: accountId,
        category_id: finalCategoryId,
        created_by_user_id: userId,
        type: 'expense', // Todos los de Report.csv son "Expense Amount" (gastos)
        amount: amount,
        currency: 'COP',
        description: notesStr || null,
        merchant_name: payeeStr || null,
        transaction_date: dateStr,
        status: 'confirmed',
        input_method: 'manual',
      });

    if (txErr) {
      console.error(`Error al importar transacción del ${dateStr} por $${amount}:`, txErr.message);
    } else {
      importedCount++;
    }
  }

  console.log(`\n--- IMPORTACIÓN COMPLETADA ---`);
  console.log(`Movimientos cargados exitosamente: ${importedCount}`);
}

startImport();
