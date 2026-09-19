import { LocalDatabase } from '../../data/local/LocalDatabase';
import { SupabaseTransactionRepository } from '../../data/repositories/SupabaseTransactionRepository';
import { SupabaseAccountRepository } from '../../data/repositories/SupabaseAccountRepository';
import { SupabaseCategoryRepository } from '../../data/repositories/SupabaseCategoryRepository';
import { SupabaseBudgetRepository } from '../../data/repositories/SupabaseBudgetRepository';
import { SupabaseTagRepository } from '../../data/repositories/SupabaseTagRepository';
import { SqliteAccountRepository } from '../../data/repositories/SqliteAccountRepository';
import { SqliteTransactionRepository } from '../../data/repositories/SqliteTransactionRepository';
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
   * Sincroniza de manera atómica y en lote los datos requeridos por el Dashboard:
   * 1. Cuentas y sus balances reales consolidados.
   * 2. Todas las transacciones confirmadas (ingresos y gastos) del mes seleccionado.
   * Guarda todo de forma segura en SQLite para que la lectura local siempre sea coherente.
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
              initialBalance: realBalance,
            };
          } catch {
            return acc;
          }
        })
      );

      // 3. Guardar cuentas con sus saldos actualizados en SQLite
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
