import { LocalDatabase } from '../../data/local/LocalDatabase';
import { SupabaseTransactionRepository } from '../../data/repositories/SupabaseTransactionRepository';
import { SupabaseAccountRepository } from '../../data/repositories/SupabaseAccountRepository';
import { SupabaseCategoryRepository } from '../../data/repositories/SupabaseCategoryRepository';
import { SupabaseBudgetRepository } from '../../data/repositories/SupabaseBudgetRepository';
import { SupabaseTagRepository } from '../../data/repositories/SupabaseTagRepository';
import { SupabaseRecurringRuleRepository } from '../../data/repositories/SupabaseRecurringRuleRepository';
import { SupabaseCategorizationRuleRepository } from '../../data/repositories/SupabaseCategorizationRuleRepository';
import { SqliteAccountRepository } from '../../data/repositories/SqliteAccountRepository';
import { SqliteTransactionRepository } from '../../data/repositories/SqliteTransactionRepository';
import { SqliteCategoryRepository } from '../../data/repositories/SqliteCategoryRepository';
import { SqliteTagRepository } from '../../data/repositories/SqliteTagRepository';
import { SqliteBudgetRepository } from '../../data/repositories/SqliteBudgetRepository';
import { SqliteRecurringRuleRepository } from '../../data/repositories/SqliteRecurringRuleRepository';
import { SqliteCategorizationRuleRepository } from '../../data/repositories/SqliteCategorizationRuleRepository';
import { CalculateAccountBalance } from '../../domain/usecases/CalculateAccountBalance';
import { Account } from '../../domain/entities/Account';
import { Transaction } from '../../domain/entities/Transaction';
import { isOnlineFast, withTimeout } from '../utils/network';
import { Platform } from 'react-native';

export class SyncService {
  private static isSyncing = false;
  private static isCloudSyncing = false;
  private static inFlightFullSync: Promise<void> | null = null;
  private static remoteTransactionRepo = new SupabaseTransactionRepository();
  private static remoteAccountRepo = new SupabaseAccountRepository();
  private static remoteCategoryRepo = new SupabaseCategoryRepository();
  private static remoteBudgetRepo = new SupabaseBudgetRepository();
  private static remoteTagRepo = new SupabaseTagRepository();
  private static remoteRecurringRuleRepo = new SupabaseRecurringRuleRepository();
  private static remoteCategorizationRepo = new SupabaseCategorizationRuleRepository();

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

      // 0. Auto-sanación: Re-encolar transacciones locales con synced = 0 que hayan quedado fuera de la cola
      try {
        const orphanUnsyncedTxs = (await db.getAllAsync<any>(
          `SELECT * FROM transactions 
           WHERE synced = 0 
             AND id NOT IN (SELECT record_id FROM sync_actions_queue WHERE table_name = 'transactions')
           LIMIT 50;`
        )) || [];
        for (const ot of orphanUnsyncedTxs) {
          const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
          await db.runAsync(
            `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
             VALUES (?, 'INSERT', 'transactions', ?, ?, ?);`,
            [actionId, ot.id, JSON.stringify(ot), ot.created_at || new Date().toISOString()]
          );
        }
      } catch (selfHealErr) {
        console.warn('[SyncService] Self-heal unsynced transactions warning:', selfHealErr);
      }

      // Obtener todas las acciones en la cola ordenadas cronológicamente
      const actions = (await db.getAllAsync<any>(
        'SELECT * FROM sync_actions_queue ORDER BY created_at ASC;'
      )) || [];

      if (!Array.isArray(actions) || actions.length === 0) {
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
              const remoteTag = await this.remoteTagRepo.create(cleanPayload);
              if (remoteTag && remoteTag.id && remoteTag.id !== recordId) {
                try {
                  await db.runAsync(
                    `INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
                     SELECT transaction_id, ? FROM transaction_tags WHERE tag_id = ?;`,
                    [remoteTag.id, recordId]
                  );
                  await db.runAsync('DELETE FROM transaction_tags WHERE tag_id = ?;', [recordId]);
                  await db.runAsync('UPDATE tags SET id = ? WHERE id = ?;', [remoteTag.id, recordId]);
                } catch (remapErr) {
                  console.warn('[SyncService] Error remapping local tag id to remote tag id:', remapErr);
                }
              }
            } else if (type === 'UPDATE') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteTagRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteTagRepo.delete(recordId);
            }
          } else if (table === 'recurring_rules') {
            if (type === 'INSERT') {
              const { familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteRecurringRuleRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteRecurringRuleRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteRecurringRuleRepo.delete(recordId);
            }
          } else if (table === 'auto_categorization_rules') {
            if (type === 'INSERT') {
              const { familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteCategorizationRepo.create(cleanPayload);
            } else if (type === 'UPDATE') {
              const { id, familyGroupId, createdAt, ...cleanPayload } = payload;
              await this.remoteCategorizationRepo.update(recordId, cleanPayload);
            } else if (type === 'DELETE') {
              await this.remoteCategorizationRepo.delete(recordId);
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
              // Si la tabla local no tiene la columna "synced", ignorar silenciosamente.
            }
          }
          console.log(`[SyncService] Successfully synced action ${action.id} (${type} on ${table})`);
        } catch (actionErr: any) {
          console.error(`[SyncService] Failed to sync action ${action.id}:`, actionErr);
          const msg = (actionErr?.message || '').toLowerCase();
          const isRetryableError = 
            msg.includes('network request failed') ||
            msg.includes('failed to fetch') ||
            msg.includes('timeout') ||
            msg.includes('abort') ||
            msg.includes('no autenticado') ||
            msg.includes('not authenticated') ||
            msg.includes('no se encontró el perfil') ||
            msg.includes('jwt') ||
            msg.includes('auth session') ||
            msg.includes('rate limit') ||
            msg.includes('too many requests') ||
            msg.includes('500') ||
            msg.includes('502') ||
            msg.includes('503') ||
            msg.includes('504') ||
            msg.includes('socket') ||
            msg.includes('connection') ||
            actionErr?.name === 'AbortError' ||
            actionErr?.status === 429 ||
            (actionErr?.status >= 500 && actionErr?.status < 600);

          if (!isRetryableError) {
            // Error no transitorio (ej. validación fatal de datos).
            // Se remueve de la cola para evitar que una sola acción bloquee permanentemente la sincronización.
            console.warn(`[SyncService] Removing non-transient action ${action.id} from queue:`, actionErr?.message);
            await db.runAsync('DELETE FROM sync_actions_queue WHERE id = ?;', [action.id]);
            // Solo marcar como synced si fue un duplicado (ya existía en el servidor)
            const isDuplicate = msg.includes('duplicate') || msg.includes('already exists') || msg.includes('23505');
            if (isDuplicate) {
              try {
                await db.runAsync(`UPDATE ${action.table_name} SET synced = 1 WHERE id = ?;`, [action.record_id]);
              } catch {
                // ignore
              }
            }
          } else {
            console.warn(`[SyncService] Transient/auth error encountered (${actionErr?.message}). Action ${action.id} remains in queue.`);
            break;
          }
        }
      }
    } catch (err) {
      console.error('[SyncService] Global error during syncPendingActions:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincroniza desde la nube hacia la base local (Descarga de réplica limpia):
   * 1. Cuentas
   * 2. Categorías
   * 3. Reglas Recurrentes (recurring_rules)
   * 4. Transacciones completas (sin truncamiento por año)
   * 5. Movimientos pendientes (DIAN, bancos, etc.)
   * 6. Presupuestos y Etiquetas
   */
  static syncCloudToLocal(): Promise<void> {
    if (Platform.OS === 'web') return Promise.resolve();
    if (this.isCloudSyncing) {
      console.log('[SyncService] syncCloudToLocal already in progress, skipping');
      return Promise.resolve();
    }

    this.isCloudSyncing = true;
    return (async () => {
      try {
        if (!(await isOnlineFast())) return;

        const localAccountRepo = new SqliteAccountRepository();
        const localTxRepo = new SqliteTransactionRepository();
        const localCatRepo = new SqliteCategoryRepository();
        const localTagRepo = new SqliteTagRepository();
        const localBudgetRepo = new SqliteBudgetRepository();
        const localRecurringRepo = new SqliteRecurringRuleRepository();
        const localCategorizationRepo = new SqliteCategorizationRuleRepository();
        const balanceUseCase = new CalculateAccountBalance(this.remoteTransactionRepo);

      // 1. Descargar y sincronizar cuentas
      const remoteAccounts = await withTimeout(this.remoteAccountRepo.getAll(), 6000, []);
      if (remoteAccounts) {
        if (remoteAccounts.length > 0) {
          const accountsWithRealBalances = await Promise.all(
            remoteAccounts.map(async (acc) => {
              try {
                const realBalance = await withTimeout(balanceUseCase.execute(acc, false), 5000, acc.initialBalance);
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

        // Reconciliación de cuentas locales huérfanas que no existan en Supabase
        try {
          const localAccounts = await localAccountRepo.getAll();
          const remoteAccNames = new Set(remoteAccounts.map(ra => (ra.name || '').trim().toLowerCase()));
          for (const la of localAccounts) {
            const cleanAccName = (la.name || '').trim().toLowerCase();
            if (cleanAccName && !remoteAccNames.has(cleanAccName)) {
              console.log(`[SyncService] Reconciling orphan local account to Supabase: ${la.name} (${la.id})`);
              await this.remoteAccountRepo.create(la);
              remoteAccNames.add(cleanAccName);
            }
          }
        } catch (accReconcileErr) {
          console.warn('[SyncService] Warning reconciling orphan accounts:', accReconcileErr);
        }
      }

      // 2. Descargar y sincronizar categorías
      try {
        const remoteCats = await withTimeout(this.remoteCategoryRepo.getAll(true), 3500, []);
        if (remoteCats) {
          if (remoteCats.length > 0) {
            await localCatRepo.bulkSave(remoteCats);
          }

          // Reconciliación de categorías personalizadas locales huérfanas
          try {
            const localCats = await localCatRepo.getAll(true);
            const remoteCatNames = new Set(remoteCats.map(rc => (rc.name || '').trim().toLowerCase()));
            for (const lc of localCats) {
              const cleanCatName = (lc.name || '').trim().toLowerCase();
              if (!lc.isSystem && cleanCatName && !remoteCatNames.has(cleanCatName)) {
                console.log(`[SyncService] Reconciling orphan local category to Supabase: ${lc.name} (${lc.id})`);
                await this.remoteCategoryRepo.create(lc);
                remoteCatNames.add(cleanCatName);
              }
            }
          } catch (catReconcileErr) {
            console.warn('[SyncService] Warning reconciling orphan categories:', catReconcileErr);
          }
        }
      } catch (catErr) {
        console.warn('[SyncService] Error syncing categories to local:', catErr);
      }

      // 3. Descargar, sincronizar y reconciliar etiquetas bidireccionalmente
      try {
        const remoteTags = await withTimeout(this.remoteTagRepo.getAll(), 3500, []);
        if (remoteTags) {
          if (remoteTags.length > 0) {
            await localTagRepo.bulkSave(remoteTags);
          }

          // Reconciliación bidireccional: detectar etiquetas locales que no existen en Supabase
          // (ej. "Trabajo" creada localmente y omitida o limpiada de la cola) y subirlas a Supabase
          const localTags = await localTagRepo.getAll();
          const remoteNamesLower = new Set(remoteTags.map(rt => (rt.name || '').trim().toLowerCase()));

          for (const localTag of localTags) {
            const cleanName = (localTag.name || '').trim().toLowerCase();
            if (cleanName && !remoteNamesLower.has(cleanName)) {
              try {
                console.log(`[SyncService] Reconciling orphan local tag to Supabase: ${localTag.name} (${localTag.id})`);
                const uploaded = await this.remoteTagRepo.create({
                  id: localTag.id,
                  name: localTag.name,
                  color: localTag.color,
                } as any);

                if (uploaded && uploaded.id && uploaded.id !== localTag.id) {
                  const db = LocalDatabase.getDb();
                  await db.runAsync(
                    `INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
                     SELECT transaction_id, ? FROM transaction_tags WHERE tag_id = ?;`,
                    [uploaded.id, localTag.id]
                  );
                  await db.runAsync('DELETE FROM transaction_tags WHERE tag_id = ?;', [localTag.id]);
                  await db.runAsync('UPDATE tags SET id = ? WHERE id = ?;', [uploaded.id, localTag.id]);
                }
                remoteNamesLower.add(cleanName);
              } catch (orphanErr) {
                console.warn(`[SyncService] Warning uploading orphan tag ${localTag.name}:`, orphanErr);
              }
            }
          }
        }
      } catch (tagErr) {
        console.warn('[SyncService] Error syncing tags to local:', tagErr);
      }

      // 4. Descargar y sincronizar reglas recurrentes (activas e inactivas para reflejar cancelaciones)
      try {
        const remoteRules = await withTimeout(this.remoteRecurringRuleRepo.getAll(), 3500, []);
        if (remoteRules && remoteRules.length > 0) {
          await localRecurringRepo.bulkSave(remoteRules);
        }
      } catch (ruleErr) {
        console.warn('[SyncService] Error syncing recurring rules to local:', ruleErr);
      }

      // 5. Descargar y sincronizar transacciones mediante Delta Sync (cursor updated_at)
      try {
        const db = LocalDatabase.getDb();
        
        // Verificar si la base de datos local de transacciones está vacía (bootstrap inicial o tras reinicio)
        let isLocalEmpty = false;
        try {
          const countRow = await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM transactions;'
          );
          isLocalEmpty = !countRow || countRow.count === 0;
        } catch {
          isLocalEmpty = true;
        }

        let lastSyncedAt: string | undefined;
        if (!isLocalEmpty) {
          try {
            const metaRow = await db.getFirstAsync<{ value: string }>(
              "SELECT value FROM sync_metadata WHERE key = 'last_synced_at';"
            );
            lastSyncedAt = metaRow?.value;
          } catch {
            lastSyncedAt = undefined;
          }
        } else {
          // Si local está vacío, invalidar cualquier cursor previo para forzar descarga histórica completa
          try {
            await db.runAsync("DELETE FROM sync_metadata WHERE key = 'last_synced_at';");
          } catch {}
          lastSyncedAt = undefined;
        }

        const filters: any = {};
        if (lastSyncedAt) {
          filters.updatedAfter = lastSyncedAt;
          filters.limit = 1000;
        }

        const remoteTransactions: Transaction[] | null = await withTimeout(
          this.remoteTransactionRepo.getAll(filters),
          15000,
          null as any
        );

        if (remoteTransactions && remoteTransactions.length > 0) {
          await localTxRepo.bulkSave(remoteTransactions);

          // Registrar cursor únicamente con el timestamp más reciente de las transacciones realmente guardadas
          const maxUpdatedAt = remoteTransactions.reduce((max: string | undefined, tx: Transaction) => {
            const u = tx.updatedAt || tx.createdAt;
            return (!max || (u && u > max)) ? u : max;
          }, lastSyncedAt);

          if (maxUpdatedAt) {
            try {
              await db.runAsync(
                "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('last_synced_at', ?, ?);",
                [maxUpdatedAt, new Date().toISOString()]
              );
            } catch {
              // Ignorar si la tabla aún no se inicializó
            }
          }
        }
      } catch (txErr) {
        console.warn('[SyncService] Error syncing transactions to local:', txErr);
      }

      // 5b. Descargar y reconciliar movimientos pendientes (Facturas DIAN, correos bancarios, etc.)
      try {
        const remotePending = await withTimeout(
          this.remoteTransactionRepo.getAll({
            status: 'pending',
          }),
          12000,
          null as any
        );

        if (remotePending && remotePending.length > 0) {
          await localTxRepo.bulkSave(remotePending);
        }
        if (remotePending !== null && Array.isArray(remotePending) && typeof (localTxRepo as any).reconcilePendingTransactions === 'function') {
          await (localTxRepo as any).reconcilePendingTransactions(remotePending);
        }
      } catch (pendingErr) {
        console.warn('[SyncService] Error syncing pending transactions to local:', pendingErr);
      }

      // 6. Descargar y sincronizar presupuestos (Ventana de 3 meses: anterior, actual y siguiente)
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const monthsToSync = [
          currentMonth === 1 ? { y: currentYear - 1, m: 12 } : { y: currentYear, m: currentMonth - 1 },
          { y: currentYear, m: currentMonth },
          currentMonth === 12 ? { y: currentYear + 1, m: 1 } : { y: currentYear, m: currentMonth + 1 },
        ];

        for (const target of monthsToSync) {
          try {
            const remoteBudgets = await withTimeout(
              this.remoteBudgetRepo.getByMonth(target.y, target.m),
              3500,
              []
            );
            if (remoteBudgets && remoteBudgets.length > 0) {
              await localBudgetRepo.bulkSave(remoteBudgets);
            }
          } catch (mErr) {
            console.warn(`[SyncService] Error syncing budgets for ${target.y}-${target.m}:`, mErr);
          }
        }
      } catch (budgetErr) {
        console.warn('[SyncService] Error syncing budgets to local:', budgetErr);
      }

      // 7. Descargar y sincronizar reglas de auto-categorización
      try {
        const remoteRules = await withTimeout(
          this.remoteCategorizationRepo.getAll(),
          3500,
          []
        );
        if (remoteRules && remoteRules.length > 0) {
          await localCategorizationRepo.bulkSave(remoteRules);
        }
      } catch (ruleErr) {
        console.warn('[SyncService] Error syncing categorization rules to local:', ruleErr);
      }

      console.log('[SyncService] Cloud to local sync completed successfully.');
      try {
        const db = LocalDatabase.getDb();
        const nowIso = new Date().toISOString();
        await db.runAsync(
          "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('last_successful_sync_at', ?, ?);",
          [nowIso, nowIso]
        );
      } catch (metaErr) {
        console.warn('[SyncService] Error saving last_successful_sync_at metadata:', metaErr);
      }
    } catch (err) {
      console.warn('[SyncService] syncCloudToLocal warning:', err);
    } finally {
      this.isCloudSyncing = false;
    }
    })();
  }

  /**
   * Obtiene el estado real de sincronización, la fecha/hora de la última réplica exitosa
   * y el número de acciones pendientes en la cola local.
   */
  static async getSyncStatus(): Promise<{
    lastSyncedAt: Date | null;
    pendingQueueCount: number;
    isOnline: boolean;
  }> {
    const isOnline = await isOnlineFast();
    if (Platform.OS === 'web') {
      return {
        lastSyncedAt: new Date(),
        pendingQueueCount: 0,
        isOnline,
      };
    }

    try {
      const db = LocalDatabase.getDb();
      const metaRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM sync_metadata WHERE key = 'last_successful_sync_at';"
      );
      const queueRow = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM sync_actions_queue;"
      );

      return {
        lastSyncedAt: metaRow?.value ? new Date(metaRow.value) : null,
        pendingQueueCount: queueRow?.count || 0,
        isOnline,
      };
    } catch {
      return {
        lastSyncedAt: null,
        pendingQueueCount: 0,
        isOnline,
      };
    }
  }

  /**
   * Realiza una sincronización bidireccional completa:
   * 1. Sube cambios locales pendientes hacia Supabase (local -> nube).
   * 2. Descarga la réplica limpia y actualizada desde Supabase hacia SQLite (nube -> local).
   */
  static fullSync(): Promise<void> {
    if (Platform.OS === 'web') return Promise.resolve();
    if (this.inFlightFullSync) {
      console.log('[SyncService] fullSync already in progress, returning active promise');
      return this.inFlightFullSync;
    }

    this.inFlightFullSync = (async () => {
      try {
        if (!(await isOnlineFast())) return;
        console.log('[SyncService] Starting full bidirectional sync...');
        await this.syncPendingActions();
        await this.syncCloudToLocal();
      } catch (err) {
        console.error('[SyncService] Full sync error:', err);
      } finally {
        this.inFlightFullSync = null;
      }
    })();

    return this.inFlightFullSync;
  }

  /**
   * Sincroniza de manera atómica y en lote los datos requeridos por el Dashboard en background
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

      // 4. Descargar transacciones confirmadas del mes seleccionado
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
