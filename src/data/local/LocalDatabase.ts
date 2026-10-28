import * as SQLite from 'expo-sqlite';

export class LocalDatabase {
  private static db: SQLite.SQLiteDatabase | null = null;

  static getDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      this.db = SQLite.openDatabaseSync('zenmoney.db');
    }
    return this.db;
  }

  static async init(): Promise<void> {
    const database = this.getDb();
    
    // Habilitar soporte de llaves foráneas y modo WAL para mejor rendimiento concurrente
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync('PRAGMA journal_mode = WAL;');

    // Tabla de cuentas
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        family_group_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        initial_balance REAL NOT NULL DEFAULT 0,
        current_balance REAL DEFAULT NULL,
        currency TEXT NOT NULL DEFAULT 'COP',
        is_active INTEGER NOT NULL DEFAULT 1,
        is_private INTEGER NOT NULL DEFAULT 0,
        closing_day INTEGER,
        payment_day INTEGER,
        color TEXT,
        icon TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // Migraciones defensivas para la tabla accounts
    const accountMigrations = [
      'ALTER TABLE accounts ADD COLUMN current_balance REAL DEFAULT NULL;',
      'ALTER TABLE accounts ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE accounts ADD COLUMN closing_day INTEGER;',
      'ALTER TABLE accounts ADD COLUMN payment_day INTEGER;',
      'ALTER TABLE accounts ADD COLUMN color TEXT;',
      'ALTER TABLE accounts ADD COLUMN icon TEXT;'
    ];
    for (const sql of accountMigrations) {
      try {
        await database.execAsync(sql);
      } catch {
        // Ignorar si la columna ya existe
      }
    }

    // Tabla de categorías
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        family_group_id TEXT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'tag',
        color TEXT NOT NULL DEFAULT '#808080',
        parent_category_id TEXT,
        budget_role TEXT NOT NULL DEFAULT 'needs',
        is_system INTEGER NOT NULL DEFAULT 0,
        is_private INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // Migraciones defensivas para la tabla categories
    try {
      await database.execAsync("ALTER TABLE categories ADD COLUMN budget_role TEXT NOT NULL DEFAULT 'needs';");
    } catch {
      // Ignorar si la columna ya existe
    }

    // Tabla de transacciones
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        family_group_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        category_id TEXT,
        created_by_user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'COP',
        description TEXT,
        merchant_name TEXT,
        transaction_date TEXT NOT NULL,
        transfer_to_account_id TEXT,
        is_recurring_instance INTEGER NOT NULL DEFAULT 0,
        recurring_rule_id TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        input_method TEXT NOT NULL DEFAULT 'manual',
        ai_metadata TEXT,
        is_private INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Tabla de presupuestos
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        family_group_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        amount_limit REAL NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        scope TEXT NOT NULL DEFAULT 'family',
        owner_user_id TEXT,
        has_rollover INTEGER NOT NULL DEFAULT 0,
        is_override INTEGER NOT NULL DEFAULT 0,
        override_reason TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // Migraciones idempotentes para bases existentes
    try {
      await database.execAsync('ALTER TABLE budgets ADD COLUMN has_rollover INTEGER NOT NULL DEFAULT 0;');
    } catch {
      // Ignorar si la columna ya existe
    }
    try {
      await database.execAsync('ALTER TABLE budgets ADD COLUMN is_override INTEGER NOT NULL DEFAULT 0;');
    } catch {
      // Ignorar si la columna ya existe
    }
    try {
      await database.execAsync('ALTER TABLE budgets ADD COLUMN override_reason TEXT;');
    } catch {
      // Ignorar si la columna ya existe
    }

    // Limpieza de duplicados y creación de índice de unicidad para presupuestos en SQLite
    try {
      await database.execAsync(`
        DELETE FROM budgets 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM budgets 
          GROUP BY category_id, year, month, scope, COALESCE(owner_user_id, ''), is_override
        );
      `);
      await database.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_sqlite_budgets_limit 
        ON budgets (category_id, year, month, scope, COALESCE(owner_user_id, ''), is_override);
      `);
    } catch {
      // Ignorar si el índice ya existe o la tabla aún está vacía
    }

    // Tabla de cola de sincronización (Sync Queue)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_actions_queue (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Tabla de metadatos de sincronización (Delta Sync Cursor)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Tabla de etiquetas (Tags)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        family_group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#808080',
        created_at TEXT NOT NULL
      );
    `);

    // Tabla intermedia transacciones-etiquetas
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS transaction_tags (
        transaction_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (transaction_id, tag_id)
      );
    `);

    // Tabla de reglas recurrentes (Recurring Rules)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_rules (
        id TEXT PRIMARY KEY,
        family_group_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        category_id TEXT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        frequency TEXT NOT NULL,
        day_of_month INTEGER,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);

    // Tabla de reglas de autocategorización
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS auto_categorization_rules (
        id TEXT PRIMARY KEY,
        family_group_id TEXT NOT NULL,
        match_pattern TEXT NOT NULL,
        category_id TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        is_ai_generated INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // Índices de alto rendimiento para escalabilidad a 5+ años (B-Trees)
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_transactions_account_status ON transactions(account_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_transactions_transfer_status ON transactions(transfer_to_account_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);',
      'CREATE INDEX IF NOT EXISTS idx_transactions_updated_synced ON transactions(updated_at, synced);',
      'CREATE INDEX IF NOT EXISTS idx_transactions_family ON transactions(family_group_id);',
      'CREATE INDEX IF NOT EXISTS idx_accounts_family ON accounts(family_group_id, is_active);',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_actions_queue(created_at);',
    ];
    for (const sql of indexes) {
      try {
        await database.execAsync(sql);
      } catch {
        // Ignorar si el índice ya existe
      }
    }
  }

  static async clearAll(): Promise<void> {
    const database = this.getDb();
    await database.execAsync('DELETE FROM transactions;');
    await database.execAsync('DELETE FROM accounts;');
    await database.execAsync('DELETE FROM categories;');
    await database.execAsync('DELETE FROM budgets;');
    await database.execAsync('DELETE FROM tags;');
    await database.execAsync('DELETE FROM transaction_tags;');
    await database.execAsync('DELETE FROM recurring_rules;');
    await database.execAsync('DELETE FROM auto_categorization_rules;');
    await database.execAsync('DELETE FROM sync_actions_queue;');
    await database.execAsync('DELETE FROM sync_metadata;');
  }
}
