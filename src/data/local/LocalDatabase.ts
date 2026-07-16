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
        currency TEXT NOT NULL DEFAULT 'COP',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);

    // Tabla de categorías
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        family_group_id TEXT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'tag',
        color TEXT NOT NULL DEFAULT '#808080',
        parent_category_id TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        is_private INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

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
        created_at TEXT NOT NULL
      );
    `);

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
  }

  static async clearAll(): Promise<void> {
    const database = this.getDb();
    await database.execAsync('DELETE FROM transactions;');
    await database.execAsync('DELETE FROM accounts;');
    await database.execAsync('DELETE FROM categories;');
    await database.execAsync('DELETE FROM budgets;');
    await database.execAsync('DELETE FROM sync_actions_queue;');
  }
}
