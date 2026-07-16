import { LocalDatabase } from '../../data/local/LocalDatabase';
import { SupabaseTransactionRepository } from '../../data/repositories/SupabaseTransactionRepository';
import { SupabaseAccountRepository } from '../../data/repositories/SupabaseAccountRepository';
import { SupabaseCategoryRepository } from '../../data/repositories/SupabaseCategoryRepository';
import { SupabaseBudgetRepository } from '../../data/repositories/SupabaseBudgetRepository';
import NetInfo from '@react-native-community/netinfo';

export class SyncService {
  private static isSyncing = false;
  private static remoteTransactionRepo = new SupabaseTransactionRepository();
  private static remoteAccountRepo = new SupabaseAccountRepository();
  private static remoteCategoryRepo = new SupabaseCategoryRepository();
  private static remoteBudgetRepo = new SupabaseBudgetRepository();

  static async syncPendingActions(): Promise<void> {
    if (this.isSyncing) return;
    
    // Verificar si hay conexión a internet
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
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
              const { synced, id, createdByUserId, familyGroupId, createdAt, updatedAt, ...cleanPayload } = payload;
              await this.remoteTransactionRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { synced, id, createdByUserId, familyGroupId, createdAt, updatedAt, ...cleanPayload } = payload;
              await this.remoteTransactionRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteTransactionRepo.delete(recordId);
            }
          } else if (table === 'accounts') {
            if (type === 'INSERT') {
              const { id, ownerUserId, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteAccountRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, ownerUserId, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteAccountRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteAccountRepo.delete(recordId);
            }
          } else if (table === 'categories') {
            if (type === 'INSERT') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteCategoryRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteCategoryRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteCategoryRepo.delete(recordId);
            }
          } else if (table === 'budgets') {
            if (type === 'INSERT') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteBudgetRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteBudgetRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteBudgetRepo.delete(recordId);
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
}
