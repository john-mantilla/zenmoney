import { LocalDatabase } from '../../data/local/LocalDatabase';
import { SupabaseTransactionRepository } from '../../data/repositories/SupabaseTransactionRepository';
import { SupabaseAccountRepository } from '../../data/repositories/SupabaseAccountRepository';
import { SupabaseCategoryRepository } from '../../data/repositories/SupabaseCategoryRepository';
import { SupabaseBudgetRepository } from '../../data/repositories/SupabaseBudgetRepository';
import { SupabaseTagRepository } from '../../data/repositories/SupabaseTagRepository';
import { SqliteAccountRepository } from '../../data/repositories/SqliteAccountRepository';
import { SqliteTransactionRepository } from '../../data/repositories/SqliteTransactionRepository';
import { SqliteCategoryRepository } from '../../data/repositories/SqliteCategoryRepository';
import { SqliteTagRepository } from '../../data/repositories/SqliteTagRepository';
import { SqliteBudgetRepository } from '../../data/repositories/SqliteBudgetRepository';
import { CalculateAccountBalance } from '../../domain/usecases/CalculateAccountBalance';
import { Account } from '../../domain/entities/Account';
import { Transaction } from '../../domain/entities/Transaction';
import { isOnlineFast, withTimeout } from '../utils/network';
import { Platform } from 'react-native';

export class SyncService {
  private static isSyncing = false;
  private static remoteTransactionRepo = new SupabaseTransactionRepository();
  private static remoteAccountRepo = new SupabaseAccountRepository();
  private static remoteCategoryRepo = new SupabaseCategoryRepository();
  private static remoteBudgetRepo = new SupabaseBudgetRepository();
  private static remoteTagRepo = new SupabaseTagRepository();

  static async syncPendingActions(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (this.isSyncing) return;
    
    // Verificar si hay conexión a internet real
    if (!(await isOnlineFast())) {
      console.log('[SyncService] Sync aborted: Device is offline.');
      return;
    }

    this.isSyncing = true;
    console.log('[SyncService] Starting synchronization of pending actions...');

    try {
      const db = LocalDatabase.getDb();
      // Obtener todas las acciones en la cola ordenadas cronológicamente
      const actions = await db.getAllAsync<any>(
        'SELECT * FROM sync_actions_queue ORDER BY created_at ASC;'
      );

      if (actions.length === 0) {
        console.log('[SyncService] No pending actions to sync.');
        this.isSyncing = false;
        return;
      }

      for (const action of actions) {
        try {
          const payload = JSON.parse(action.payload);
          const table = action.table_name;
          const type = action.action_type;
          const recordId = action.record_id;

          if (table === 'transactions') {
            if (type === 'INSERT') {
              const { synced, createdByUserId, familyGroupId, createdAt, updatedAt, ...cleanPayload } = payload;
              await this.remoteTransactionRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { synced, id, createdByUserId, familyGroupId, createdAt, updatedAt, ...cleanPayload } = payload;
              await this.remoteTransactionRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteTransactionRepo.delete(recordId);
            }
          } else if (table === 'accounts') {
            if (type === 'INSERT') {
              const { ownerUserId, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteAccountRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, ownerUserId, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteAccountRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteAccountRepo.delete(recordId);
            }
          } else if (table === 'categories') {
            if (type === 'INSERT') {
              const { familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteCategoryRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteCategoryRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteCategoryRepo.delete(recordId);
            }
          } else if (table === 'budgets') {
            if (type === 'INSERT') {
              const { familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteBudgetRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteBudgetRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteBudgetRepo.delete(recordId);
            }
          } else if (table === 'tags') {
            if (type === 'INSERT') {
              const { familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteTagRepo.create(cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteTagRepo.delete(recordId);
            }
          }

          // Eliminar la acción procesada con éxito de la cola local
          await db.runAsync('DELETE FROM sync_actions_queue WHERE id = ?;', [action.id]);
          // Marcar el registro local como sincronizado
          if (type !== 'DELETE') {
            try {
              await db.runAsync(
                `UPDATE ${table} SET synced = 1 WHERE id = ?;`,
                [recordId]
              );
            } catch (updateLocalErr) {
              // Si la tabla local no tiene la columna "synced" (como categories o budgets que no la necesitan), ignorar silenciosamente.
            }
          }
          console.log(`[SyncService] Successfully synced action ${action.id} (${type} on ${table})`);
        } catch (actionErr: any) {
          console.error(`[SyncService] Failed to sync action ${action.id}:`, actionErr);
          // Si el registro falló porque ya existe en el servidor, podemos limpiar el conflicto
          if (
            actionErr?.message?.includes('duplicate key') || 
            actionErr?.message?.includes('already exists') ||
            actionErr?.message?.includes('Constraint')
          ) {
            await db.runAsync('DELETE FROM sync_actions_queue WHERE id = ?;', [action.id]);
            try {
              await db.runAsync(`UPDATE ${action.table_name} SET synced = 1 WHERE id = ?;`, [action.record_id]);
            } catch {
              // ignore
            }
          } else {
            // Si es un error de conexión o de red temporal, detenemos para procesar después
            break;
          }
        }
      }
    } catch (err) {
      console.error('[SyncService] Global sync error:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Descarga una copia espejo limpia desde la nube hacia la base de datos local SQLite:
   * 1. Cuentas con sus balances consolidados calculados (currentBalance) sin alterar initialBalance.
   * 2. Categorías.
   * 3. Etiquetas.
   * 4. Transacciones confirmadas del año actual y recientes.
   * 5. Presupuestos.
   */
  static async syncCloudToLocal(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!(await isOnlineFast())) return;

    try {
      const localAccountRepo = new SqliteAccountRepository();
      const localTxRepo = new SqliteTransactionRepository();
      const localCatRepo = new SqliteCategoryRepository();
      const localTagRepo = new SqliteTagRepository();
      const localBudgetRepo = new SqliteBudgetRepository();
      const balanceUseCase = new CalculateAccountBalance(this.remoteTransactionRepo);

      // 1. Descargar y sincronizar cuentas con sus saldos reales consolidados en current_balance
      const remoteAccounts = await withTimeout(this.remoteAccountRepo.getAll(), 3500, []);
      if (remoteAccounts && remoteAccounts.length > 0) {
        const accountsWithRealBalances = await Promise.all(
          remoteAccounts.map(async (acc) => {
            try {
              const realBalance = await withTimeout(balanceUseCase.execute(acc, false), 3500, acc.initialBalance);
              return {
                ...acc,
                currentBalance: realBalance,
              };
            } catch {
              return {
                ...acc,
                currentBalance: acc.initialBalance,
              };
            }
          })
        );
        await localAccountRepo.bulkSave(accountsWithRealBalances);
      }

      // 2. Descargar y sincronizar categorías
      try {
        const remoteCats = await withTimeout(this.remoteCategoryRepo.getAll(true), 3500, []);
        if (remoteCats && remoteCats.length > 0) {
          await localCatRepo.bulkSave(remoteCats);
        }
      } catch (catErr) {
        console.warn('[SyncService] Error syncing categories to local:', catErr);
      }

      // 3. Descargar y sincronizar etiquetas
      try {
        const remoteTags = await withTimeout(this.remoteTagRepo.getAll(), 3500, []);
        if (remoteTags && remoteTags.length > 0) {
          await localTagRepo.bulkSave(remoteTags);
        }
      } catch (tagErr) {
        console.warn('[SyncService] Error syncing tags to local:', tagErr);
      }

      // 4. Descargar y sincronizar transacciones recientes (año en curso)
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const startDate = `${currentYear}-01-01`;
        const endDate = `${currentYear}-12-31`;

        const remoteTransactions = await withTimeout(
          this.remoteTransactionRepo.getAll({
            startDate,
            endDate,
            status: 'confirmed',
          }),
          4500,
          []
        );

        if (remoteTransactions && remoteTransactions.length > 0) {
          await localTxRepo.bulkSave(remoteTransactions);
        }
      } catch (txErr) {
        console.warn('[SyncService] Error syncing transactions to local:', txErr);
      }

      // 5. Descargar y sincronizar presupuestos
      try {
        const now = new Date();
        const remoteBudgets = await withTimeout(
          this.remoteBudgetRepo.getByMonth(now.getFullYear(), now.getMonth() + 1),
          3500,
          []
        );
        if (remoteBudgets && remoteBudgets.length > 0) {
          await localBudgetRepo.bulkSave(remoteBudgets);
        }
      } catch (budgetErr) {
        console.warn('[SyncService] Error syncing budgets to local:', budgetErr);
      }

      console.log('[SyncService] Cloud to local sync completed successfully.');
    } catch (err) {
      console.warn('[SyncService] syncCloudToLocal warning:', err);
    }
  }

  /**
   * Realiza una sincronización bidireccional completa:
   * 1. Sube cambios locales pendientes hacia Supabase (local -> nube).
   * 2. Descarga la réplica limpia y actualizada desde Supabase hacia SQLite (nube -> local).
   */
  static async fullSync(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!(await isOnlineFast())) return;

    try {
      console.log('[SyncService] Starting full bidirectional sync...');
      await this.syncPendingActions();
      await this.syncCloudToLocal();
    } catch (err) {
      console.error('[SyncService] Full sync error:', err);
    }
  }

  /**
   * Sincroniza de manera atómica y en lote los datos requeridos por el Dashboard:
   * 1. Cuentas y sus balances reales consolidados en current_balance.
   * 2. Todas las transacciones confirmadas (ingresos y gastos) del mes seleccionado.
   */
  static async syncDashboardData(year: number, month: number): Promise<{
    accounts: Account[];
    monthTransactions: Transaction[];
  } | null> {
    if (Platform.OS === 'web') return null;

    if (!(await isOnlineFast())) {
      return null;
    }

    try {
      const localAccountRepo = new SqliteAccountRepository();
      const localTxRepo = new SqliteTransactionRepository();
      const balanceUseCase = new CalculateAccountBalance(this.remoteTransactionRepo);

      // 1. Obtener cuentas de la nube
      const remoteAccounts = await withTimeout(this.remoteAccountRepo.getAll(), 3500);
      if (!remoteAccounts || remoteAccounts.length === 0) {
        return null;
      }

      // 2. Calcular saldos reales con timeout seguro
      const accountsWithRealBalances = await Promise.all(
        remoteAccounts.map(async (acc) => {
          try {
            const realBalance = await withTimeout(balanceUseCase.execute(acc, false), 3500, acc.initialBalance);
            return {
              ...acc,
              currentBalance: realBalance,
            };
          } catch {
            return acc;
          }
        })
      );

      // 3. Guardar cuentas con sus saldos actualizados en SQLite (current_balance)
      await localAccountRepo.bulkSave(accountsWithRealBalances);

      // 4. Descargar todas las transacciones confirmadas del mes seleccionado (ingresos y gastos)
      const lastDay = new Date(year, month, 0).getDate();
      const monthStr = String(month).padStart(2, '0');
      const startDate = `${year}-${monthStr}-01`;
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const remoteTransactions = await withTimeout(
        this.remoteTransactionRepo.getAll({
          startDate,
          endDate,
          status: 'confirmed',
        }),
        3500
      );

      if (remoteTransactions && remoteTransactions.length > 0) {
        await localTxRepo.bulkSave(remoteTransactions);
      }

      return {
        accounts: accountsWithRealBalances,
        monthTransactions: remoteTransactions || [],
      };
    } catch (err) {
      console.warn('[SyncService] syncDashboardData warning:', err);
      return null;
    }
  }
}
