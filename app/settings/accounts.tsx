/**
 * ZenMoney — Gestión de Cuentas y Deudas (Modular)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { Button, Card, Text, Switch, ActivityIndicator, Dialog, Portal, TextInput, IconButton, Appbar, HelperText } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '@/src/presentation/theme';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { SupabaseRecurringRuleRepository } from '@/src/data/repositories/SupabaseRecurringRuleRepository';
import { SupabaseTransactionRepository } from '@/src/data/repositories/SupabaseTransactionRepository';
import { GenerateRecurringInstances } from '@/src/domain/usecases/GenerateRecurringInstances';
import { Account, AccountType } from '@/src/domain/entities/Account';
import { RecurringRule } from '@/src/domain/entities/RecurringRule';
import { inferAccountBrand, getAccountBrandInfo, BRAND_COLORS } from '@/src/presentation/theme/accountBrands';
import { CreateAccountModal, CreateAccountData, AccountIcon } from '@/src/presentation/components';
import { useAccountCustomizationStore } from '@/src/infrastructure/state/accountCustomizationStore';
import { useAccountPreferenceStore } from '@/src/infrastructure/state/accountPreferenceStore';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsAccountsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Preferencias de cuentas (Cuenta Principal)
  const defaultAccountId = useAccountPreferenceStore((state) => state.defaultAccountId);
  const setDefaultAccountId = useAccountPreferenceStore((state) => state.setDefaultAccountId);

  // Estados de datos
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de diálogo
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [initialBalanceInput, setInitialBalanceInput] = useState('');
  const [accountColor, setAccountColor] = useState('');
  const [accountIcon, setAccountIcon] = useState('');
  const [isManualBrandSet, setIsManualBrandSet] = useState(false);
  
  // Parámetros de cuotas automáticas
  const [hasInstallment, setHasInstallment] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [installmentSourceAccountId, setInstallmentSourceAccountId] = useState('');
  const [installmentEndDate, setInstallmentEndDate] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [paymentDay, setPaymentDay] = useState('');

  const [savingAccount, setSavingAccount] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const accountRepo = new HybridAccountRepository();
  const recurrenceRepo = new SupabaseRecurringRuleRepository();
  const transactionRepo = new SupabaseTransactionRepository();

  // Calcula la próxima fecha (hoy o futura) en que cae el día de pago elegido, para que
  // la primera cuota generada caiga en el día correcto en vez de en la fecha de "hoy"
  // (que es lo que anclaba mal las auto-cuotas antes de este fix).
  const computeAlignedStartDate = (day: number): string => {
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth(); // 0-11
    if (today.getDate() > day) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(day, lastDayOfMonth);
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const loadedAccounts = await accountRepo.getAll();
      setAccounts(loadedAccounts);

      const loadedRules = await recurrenceRepo.getAllActive();
      setRecurringRules(loadedRules);

      if (loadedAccounts.length > 0 && !installmentSourceAccountId) {
        const mainAhorros = loadedAccounts.find(a => a.type === 'bank') || loadedAccounts[0];
        setInstallmentSourceAccountId(mainAhorros.id);
      }
    } catch (err) {
      console.error('[Accounts Settings Screen Load Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleToggleAccountActive = async (account: Account) => {
    try {
      await accountRepo.update(account.id, { isActive: !account.isActive } as any);
      loadData();
    } catch (err) {
      console.error('Error al cambiar estado de cuenta:', err);
    }
  };

  const [customLogoUri, setCustomLogoUri] = useState<string | null>(null);

  const handlePickAccountImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMsg('Necesitamos acceso a tus fotos para seleccionar un logo.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setCustomLogoUri(res.assets[0].uri);
        setIsManualBrandSet(true);
      }
    } catch (e) {
      console.warn('[Pick Account Image Error]', e);
    }
  };

  const openAccountCreateDialog = () => {
    setSelectedAccount(null);
    setAccountName('');
    setAccountType('bank');
    setInitialBalanceInput('');
    setAccountColor('');
    setAccountIcon('');
    setCustomLogoUri(null);
    setIsManualBrandSet(false);
    setHasInstallment(false);
    setInstallmentAmount('');
    setInstallmentEndDate('');
    setClosingDay('');
    setPaymentDay('');
    setIsPrivate(false);
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  const openAccountEditDialog = (account: Account) => {
    setErrorMsg(null);
    setSelectedAccount(account);
    setAccountName(account.name);
    setAccountType(account.type);
    
    // Al editar: pre-cargar el color de la cuenta (o inferido inicial) y marcar que se respete la selección
    const brand = getAccountBrandInfo(account);
    setAccountColor(account.color || brand.color);
    setAccountIcon(account.icon || brand.icon);
    setIsManualBrandSet(true);
    
    setClosingDay(account.closingDay ? String(account.closingDay) : '');
    setPaymentDay(account.paymentDay ? String(account.paymentDay) : '');
    setIsPrivate(account.isPrivate || false);
    
    const existingRule = recurringRules.find(r => r.description === `Pago cuota: ${account.name}`);
    if (existingRule) {
      setHasInstallment(true);
      setInstallmentAmount(String(existingRule.amount));
      setInstallmentSourceAccountId(existingRule.accountId);
      setInstallmentEndDate(existingRule.endDate || '');
    } else {
      setHasInstallment(false);
      setInstallmentAmount('');
      setInstallmentEndDate('');
    }
    
    setIsDialogVisible(true);
  };

  const handleNameOrTypeChange = (newName: string, newType: AccountType) => {
    setAccountName(newName);
    setAccountType(newType);
    // Auto-inferir marca SOLAMENTE si se está CREANDO una cuenta nueva y no se ha seleccionado color manualmente
    if (!selectedAccount && !isManualBrandSet) {
      const inferred = inferAccountBrand(newName, newType);
      setAccountColor(inferred.color);
      setAccountIcon(inferred.icon);
    }
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveAccount = async (data?: CreateAccountData) => {
    const targetName = (data?.name ?? accountName).trim();
    const targetType = data?.type ?? accountType;
    const targetInitialBalance = data?.initialBalance !== undefined 
      ? data.initialBalance 
      : (parseFloat(initialBalanceInput.replace(/[^0-9.]/g, '')) || 0);
    const targetClosingDay = data?.closingDay !== undefined 
      ? data.closingDay 
      : (closingDay ? parseInt(closingDay) : null);
    const targetPaymentDay = data?.paymentDay !== undefined 
      ? data.paymentDay 
      : (paymentDay ? parseInt(paymentDay) : null);
    const targetIsPrivate = data?.isPrivate !== undefined 
      ? data.isPrivate 
      : isPrivate;
    const targetHasInstallment = data?.hasInstallment !== undefined 
      ? data.hasInstallment 
      : hasInstallment;
    const targetInstallmentAmount = data?.installmentAmount !== undefined 
      ? String(data.installmentAmount) 
      : installmentAmount;
    const targetInstallmentEndDate = data?.installmentEndDate !== undefined 
      ? data.installmentEndDate 
      : installmentEndDate;
    const targetInstallmentSourceAccountId = data?.installmentSourceAccountId !== undefined 
      ? data.installmentSourceAccountId 
      : installmentSourceAccountId;

    if (!targetName) {
      const msg = 'Por favor ingresa un nombre para la cuenta.';
      setErrorMsg(msg);
      throw new Error(msg);
    }
    if (targetHasInstallment && targetInstallmentAmount.trim() && !targetInstallmentEndDate.trim()) {
      const msg = 'Define la fecha de fin de la cuota: todas las facturas se crean de una sola vez entre el inicio y el fin.';
      setErrorMsg(msg);
      throw new Error(msg);
    }
    setErrorMsg(null);
    setSavingAccount(true);
    try {
      let savedAccount: Account;

      const finalBrand = inferAccountBrand(targetName, targetType);
      const colorToSave = data?.color || accountColor || finalBrand.color;
      const iconToSave = data?.icon || accountIcon || finalBrand.icon;
      if (selectedAccount) {
        savedAccount = await accountRepo.update(selectedAccount.id, {
          name: targetName,
          type: targetType,
          closingDay: targetClosingDay,
          paymentDay: targetPaymentDay,
          isPrivate: targetIsPrivate,
        } as any);
      } else {
        savedAccount = await accountRepo.create({
          name: targetName,
          type: targetType,
          initialBalance: targetInitialBalance,
          currency: 'COP',
          closingDay: targetClosingDay,
          paymentDay: targetPaymentDay,
          isPrivate: targetIsPrivate,
        });
      }

      // Guardar personalización de color e ícono en el store Zustand
      if (savedAccount && savedAccount.id) {
        const store = useAccountCustomizationStore.getState();
        store.setCustomColor(savedAccount.id, colorToSave);
        store.setCustomIcon(savedAccount.id, iconToSave);

        // Actualizar preferencia de cuenta principal si fue definida en el modal
        if (data?.isDefault !== undefined) {
          if (data.isDefault) {
            setDefaultAccountId(savedAccount.id);
          } else if (defaultAccountId === savedAccount.id) {
            setDefaultAccountId(null);
          }
        }
      }

      // Procesamiento de auto-cuotas para créditos o tarjetas de deuda
      const existingRule = recurringRules.find(r => r.description === `Pago cuota: ${savedAccount.name}`);
      const generator = new GenerateRecurringInstances(transactionRepo);

      if (targetHasInstallment && targetInstallmentAmount.trim()) {
        const parsedAmount = parseFloat(targetInstallmentAmount.replace(/[^0-9.]/g, '')) || 0;
        const parsedDay = targetPaymentDay || savedAccount.paymentDay || 5;
        const parsedEndDate = targetInstallmentEndDate.trim();

        if (existingRule) {
          // Editar la cuota NUNCA toca las facturas ya creadas (monto, día o cuenta se
          // pueden cambiar libremente sin que el sistema las regenere). Solo si se EXTIENDE
          // la fecha de fin (o se le agrega una por primera vez a una cuota antigua sin
          // fecha de fin) se generan las facturas nuevas que faltan; si se ACORTA, se borran
          // las pendientes que quedaron después de la nueva fecha de fin. execute() es
          // idempotente: nunca duplica una fecha que ya tenga factura creada.
          const oldEndDate = existingRule.endDate;
          const updatedRule = await recurrenceRepo.update(existingRule.id, {
            amount: parsedAmount,
            dayOfMonth: parsedDay,
            accountId: targetInstallmentSourceAccountId || installmentSourceAccountId,
            endDate: parsedEndDate,
          });
          if (!oldEndDate || parsedEndDate > oldEndDate) {
            await generator.execute(updatedRule, updatedRule.startDate, parsedEndDate);
          } else if (parsedEndDate < oldEndDate) {
            const pendingInstances = await transactionRepo.getAll({
              recurringRuleId: existingRule.id,
              status: 'pending',
            });
            const toRemove = pendingInstances.filter(tx => tx.transactionDate > parsedEndDate);
            await Promise.all(toRemove.map(tx => transactionRepo.delete(tx.id)));
          }
        } else {
          // Crear regla recurrente de egreso desde la cuenta de ahorros, y generar de una
          // sola vez todas las cuotas entre hoy y la fecha de fin.
          const startDate = computeAlignedStartDate(parsedDay);
          const createdRule = await recurrenceRepo.create({
            accountId: targetInstallmentSourceAccountId || installmentSourceAccountId,
            categoryId: null, // Sin categoría predeterminada
            type: 'expense',
            amount: parsedAmount,
            description: `Pago cuota: ${savedAccount.name}`,
            frequency: 'monthly',
            dayOfMonth: parsedDay,
            startDate,
            endDate: parsedEndDate,
          });
          await generator.execute(createdRule, startDate, parsedEndDate);
        }
      } else if (!targetHasInstallment && existingRule) {
        // Eliminar regla si se desactivó, junto con las facturas pendientes que
        // ya había generado (las pagadas/confirmadas se conservan como historial).
        await recurrenceRepo.delete(existingRule.id);
        try {
          const pendingInstances = await transactionRepo.getAll({
            recurringRuleId: existingRule.id,
            status: 'pending',
          });
          await Promise.all(pendingInstances.map(tx => transactionRepo.delete(tx.id)));
        } catch (purgeErr) {
          console.warn('Error al depurar facturas pendientes de la cuota desactivada:', purgeErr);
        }
      }

      setIsDialogVisible(false);
      setSelectedAccount(null);
      await loadData();
    } catch (err) {
      console.error('Error al guardar cuenta:', err);
      const msg = err instanceof Error ? err.message : 'Error al guardar la cuenta.';
      setErrorMsg(msg);
      throw err;
    } finally {
      setSavingAccount(false);
    }
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'bank': return 'bank';
      case 'cash': return 'cash-multiple';
      case 'credit_card': return 'credit-card';
      case 'loan': return 'bank-minus';
      case 'investment': return 'chart-line';
      default: return 'help-circle';
    }
  };

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'bank': return 'Banco';
      case 'cash': return 'Efectivo';
      case 'credit_card': return 'Tarjeta de Crédito';
      case 'loan': return 'Crédito';
      case 'investment': return 'Inversión';
      default: return type;
    }
  };

  const groupAccounts = () => {
    const disponibles = accounts.filter(a => ['bank', 'cash'].includes(a.type));
    const deudas = accounts.filter(a => ['credit_card', 'loan', 'mortgage'].includes(a.type));
    const inversiones = accounts.filter(a => a.type === 'investment');

    return [
      { title: 'Disponibles (Dinero Líquido)', data: disponibles },
      { title: 'Deudas y Tarjetas (Pasivos)', data: deudas },
      { title: 'Inversiones (Activos)', data: inversiones },
    ].filter(g => g.data.length > 0);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }} statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Gestionar Cuentas" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
        <Button
          mode="contained"
          icon="plus"
          onPress={openAccountCreateDialog}
          style={styles.addBtn}
        >
          Nueva Cuenta o Deuda
        </Button>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <Card style={styles.card}>
            <Card.Content>
              {accounts.length === 0 ? (
                <Text style={{ textAlign: 'center', opacity: 0.6, paddingVertical: 24 }}>
                  No tienes cuentas configuradas.
                </Text>
              ) : (
                <View style={styles.accountsList}>
                  {groupAccounts().map((group) => (
                    <View key={group.title} style={{ marginBottom: 18 }}>
                      <Text style={[
                        theme.typography.label,
                        {
                          color: theme.colors.primary,
                          fontWeight: 'bold',
                          marginBottom: 8,
                          opacity: 0.8,
                          fontSize: 12
                        }
                      ]}>
                        {group.title}
                      </Text>
                      {group.data.map((account) => {
                        const brand = getAccountBrandInfo(account);
                        const finalColor = brand.color;
                        const finalIcon = brand.icon;
                        const isDefault = defaultAccountId === account.id;

                        return (
                          <View key={account.id} style={styles.accountRow}>
                            <Pressable style={styles.accountMeta} onPress={() => openAccountEditDialog(account)}>
                              <AccountIcon
                                icon={finalIcon}
                                size={38}
                                backgroundColor={account.isActive ? finalColor : theme.colors.outline}
                                style={{ marginRight: 12 }}
                              />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[
                                    theme.typography.body,
                                    {
                                      textDecorationLine: account.isActive ? 'none' : 'line-through',
                                      opacity: account.isActive ? 1 : 0.5,
                                      fontWeight: '600'
                                    }
                                  ]}>
                                    {account.name}
                                  </Text>
                                  {isDefault && (
                                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>Principal</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                                  {getAccountTypeLabel(account.type)} {account.isPrivate ? '• 🙈 Privada' : ''}
                                </Text>
                              </View>
                            </Pressable>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <IconButton
                                icon={isDefault ? 'star' : 'star-outline'}
                                iconColor={isDefault ? '#F59E0B' : theme.customColors.textSecondary}
                                size={22}
                                onPress={() => setDefaultAccountId(isDefault ? null : account.id)}
                                style={{ margin: 0 }}
                                accessibilityLabel={isDefault ? 'Quitar como cuenta principal' : 'Establecer como cuenta principal'}
                              />
                              <Switch
                                value={account.isActive}
                                onValueChange={() => handleToggleAccountActive(account)}
                                color={theme.colors.primary}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* ─── MODAL IMPECCABLE: CREAR / EDITAR CUENTA O DEUDA ───────────── */}
      <CreateAccountModal
        visible={isDialogVisible}
        onClose={() => {
          setIsDialogVisible(false);
          setSelectedAccount(null);
        }}
        onSave={async (data) => {
          await handleSaveAccount(data);
        }}
        editingAccount={selectedAccount}
        accounts={accounts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 780 : '100%',
    alignSelf: 'center',
  },
  addBtn: {
    marginBottom: 16,
    borderRadius: 8,
  },
  card: {
    borderRadius: 12,
    elevation: 1,
  },
  accountsList: {
    marginTop: 0,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  accountMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIcon: {
    marginRight: 16,
  },
  dialogInput: {
    marginBottom: 12,
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  typeBtn: {
    marginRight: 6,
    marginBottom: 8,
    borderRadius: 8,
  },
  autoInstallmentSection: {
    marginTop: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
});
