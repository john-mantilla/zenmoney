/**
 * ZenMoney — Gestión de Cuentas y Deudas (Modular)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { Button, Card, Text, Switch, ActivityIndicator, Dialog, Portal, TextInput, IconButton, Appbar, HelperText } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '@/src/presentation/theme';
import { SupabaseAccountRepository } from '@/src/data/repositories/SupabaseAccountRepository';
import { SupabaseRecurringRuleRepository } from '@/src/data/repositories/SupabaseRecurringRuleRepository';
import { SupabaseTransactionRepository } from '@/src/data/repositories/SupabaseTransactionRepository';
import { GenerateRecurringInstances } from '@/src/domain/usecases/GenerateRecurringInstances';
import { Account, AccountType } from '@/src/domain/entities/Account';
import { RecurringRule } from '@/src/domain/entities/RecurringRule';
import { inferAccountBrand, getAccountBrandInfo, BRAND_COLORS } from '@/src/presentation/theme/accountBrands';
import { useAccountCustomizationStore } from '@/src/infrastructure/state/accountCustomizationStore';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsAccountsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const accountRepo = new SupabaseAccountRepository();
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

  const handleSaveAccount = async () => {
    if (!accountName.trim()) return;
    if (hasInstallment && installmentAmount.trim() && !installmentEndDate.trim()) {
      setErrorMsg('Define la fecha de fin de la cuota: todas las facturas se crean de una sola vez entre el inicio y el fin.');
      return;
    }
    setErrorMsg(null);
    setSavingAccount(true);
    try {
      let savedAccount: Account;

      const finalBrand = inferAccountBrand(accountName, accountType);
      const colorToSave = accountColor || finalBrand.color;
      const iconToSave = accountIcon || finalBrand.icon;
      if (selectedAccount) {
        savedAccount = await accountRepo.update(selectedAccount.id, {
          name: accountName.trim(),
          type: accountType,
          closingDay: closingDay ? parseInt(closingDay) : null,
          paymentDay: paymentDay ? parseInt(paymentDay) : null,
          isPrivate,
        } as any);
      } else {
        const parsedInitialBalance = parseFloat(initialBalanceInput.replace(/[^0-9.]/g, '')) || 0;
        savedAccount = await accountRepo.create({
          name: accountName.trim(),
          type: accountType,
          initialBalance: parsedInitialBalance,
          currency: 'COP',
          closingDay: closingDay ? parseInt(closingDay) : null,
          paymentDay: paymentDay ? parseInt(paymentDay) : null,
          isPrivate,
        });
      }

      // Guardar personalización de color e ícono en el store Zustand
      if (savedAccount && savedAccount.id) {
        const store = useAccountCustomizationStore.getState();
        store.setCustomColor(savedAccount.id, colorToSave);
        store.setCustomIcon(savedAccount.id, iconToSave);
      }

      // Procesamiento de auto-cuotas para créditos o tarjetas de deuda
      const existingRule = recurringRules.find(r => r.description === `Pago cuota: ${savedAccount.name}`);
      const generator = new GenerateRecurringInstances(transactionRepo);

      if (hasInstallment && installmentAmount.trim()) {
        const parsedAmount = parseFloat(installmentAmount.replace(/[^0-9.]/g, '')) || 0;
        const parsedDay = savedAccount.paymentDay || 5;
        const parsedEndDate = installmentEndDate.trim();

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
            accountId: installmentSourceAccountId,
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
            accountId: installmentSourceAccountId,
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
      } else if (!hasInstallment && existingRule) {
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
      loadData();
    } catch (err) {
      console.error('Error al guardar cuenta:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la cuenta.');
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
                        return (
                          <View key={account.id} style={styles.accountRow}>
                            <Pressable style={styles.accountMeta} onPress={() => openAccountEditDialog(account)}>
                              <View
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 18,
                                  backgroundColor: account.isActive ? finalColor : theme.colors.outline,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  marginRight: 12,
                                }}
                              >
                                <MaterialCommunityIcons
                                  name={finalIcon as any}
                                  size={20}
                                  color="#FFFFFF"
                                />
                              </View>
                              <View>
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
                                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                                  {getAccountTypeLabel(account.type)} {account.isPrivate ? '• 🙈 Privada' : ''}
                                </Text>
                              </View>
                            </Pressable>
                            <Switch
                              value={account.isActive}
                              onValueChange={() => handleToggleAccountActive(account)}
                              color={theme.colors.primary}
                            />
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

      {/* ─── PORTAL DIÁLOGO: AGREGAR / EDITAR CUENTA ───────────────────── */}
      <Portal>
        <Dialog 
          visible={isDialogVisible} 
          onDismiss={() => setIsDialogVisible(false)}
          style={{ maxHeight: '80%', borderRadius: 12 }}
        >
          <Dialog.Title>{selectedAccount ? 'Editar Cuenta' : 'Nueva Cuenta o Deuda'}</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0, borderTopWidth: 0, borderBottomWidth: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }} keyboardShouldPersistTaps="handled">
              <HelperText type="error" visible={!!errorMsg}>
                {errorMsg}
              </HelperText>
              {/* Fila Única: Avatar Cromático + Nombre de Cuenta */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: accountColor || inferAccountBrand(accountName, accountType).color,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: theme.colors.outline + '40',
                  }}
                >
                  <MaterialCommunityIcons
                    name={(accountIcon || inferAccountBrand(accountName, accountType).icon) as any}
                    size={24}
                    color="#FFFFFF"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Nombre de la Cuenta (ej: Bancolombia, Nequi, Nu)"
                    value={accountName}
                    onChangeText={(txt) => handleNameOrTypeChange(txt, accountType)}
                    mode="outlined"
                    disabled={savingAccount}
                  />
                </View>
              </View>

              {/* Selector de Tipo de Cuenta (5 Básicos) */}
              <Text style={[theme.typography.caption, { marginBottom: 6, color: theme.customColors.textSecondary, fontWeight: '600' }]}>
                Tipo de Cuenta:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                {(['bank', 'cash', 'credit_card', 'loan', 'investment'] as AccountType[]).map((t) => (
                  <Button
                    key={t}
                    mode={accountType === t ? 'contained' : 'outlined'}
                    compact
                    style={{ marginRight: 8, borderRadius: 8 }}
                    onPress={() => handleNameOrTypeChange(accountName, t)}
                    disabled={savingAccount}
                  >
                    {getAccountTypeLabel(t)}
                  </Button>
                ))}
              </ScrollView>

              {/* Paleta Horizontal de Colores */}
              <Text style={[theme.typography.caption, { marginBottom: 6, color: theme.customColors.textSecondary, fontWeight: '600' }]}>
                Color de Marca / Fondo del Ícono:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 14 }}>
                {BRAND_COLORS.map(c => {
                  const activeColor = accountColor || inferAccountBrand(accountName, accountType).color;
                  const isSelected = activeColor.toLowerCase() === c.color.toLowerCase();
                  return (
                    <Pressable
                      key={c.color}
                      onPress={() => {
                        setAccountColor(c.color);
                        setIsManualBrandSet(true);
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: c.color,
                        marginRight: 8,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: isSelected ? 3 : 1,
                        borderColor: isSelected ? theme.colors.primary : '#FFFFFF',
                      }}
                    >
                      {isSelected && <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!selectedAccount && (
                <TextInput
                  label="Saldo Inicial ($ COP)"
                  value={initialBalanceInput}
                  onChangeText={(txt) => setInitialBalanceInput(txt.replace(/[^0-9]/g, ''))}
                  mode="outlined"
                  keyboardType="numeric"
                  placeholder="0"
                  style={styles.dialogInput}
                  disabled={savingAccount}
                />
              )}

              {['credit_card'].includes(accountType) && (
                <>
                  <TextInput
                    label="Día de Corte de Facturación (1 - 31)"
                    value={closingDay}
                    onChangeText={txt => {
                      const num = parseInt(txt.replace(/[^0-9]/g, '')) || '';
                      setClosingDay(num === '' ? '' : String(Math.min(31, Math.max(1, Number(num)))));
                    }}
                    mode="outlined"
                    keyboardType="numeric"
                    placeholder="15"
                    style={styles.dialogInput}
                    disabled={savingAccount}
                  />
                  
                  <TextInput
                    label="Día de Pago de la Tarjeta (1 - 31)"
                    value={paymentDay}
                    onChangeText={txt => {
                      const num = parseInt(txt.replace(/[^0-9]/g, '')) || '';
                      setPaymentDay(num === '' ? '' : String(Math.min(31, Math.max(1, Number(num)))));
                    }}
                    mode="outlined"
                    keyboardType="numeric"
                    placeholder="2"
                    style={styles.dialogInput}
                    disabled={savingAccount}
                  />
                </>
              )}

              {['loan', 'mortgage'].includes(accountType) && (
                <TextInput
                  label="Día de Pago de la Cuota (1 - 31)"
                  value={paymentDay}
                  onChangeText={txt => {
                    const num = parseInt(txt.replace(/[^0-9]/g, '')) || '';
                    setPaymentDay(num === '' ? '' : String(Math.min(31, Math.max(1, Number(num)))));
                  }}
                  mode="outlined"
                  keyboardType="numeric"
                  placeholder="5"
                  style={styles.dialogInput}
                  disabled={savingAccount}
                />
              )}

              {/* Configurar cuota mensual para deudas (Tarjeta o Crédito) */}
              {['credit_card', 'loan', 'mortgage'].includes(accountType) && (
                <View style={styles.autoInstallmentSection}>
                  <View style={styles.switchRow}>
                    <Text style={theme.typography.body}>¿Tiene cobro / cuota mensual fija?</Text>
                    <Switch
                      value={hasInstallment}
                      onValueChange={setHasInstallment}
                      color={theme.colors.primary}
                      disabled={savingAccount}
                    />
                  </View>

                  {hasInstallment && (
                    <View>
                      <TextInput
                        label="Monto de la Cuota ($)"
                        value={installmentAmount}
                        onChangeText={(txt) => setInstallmentAmount(txt.replace(/[^0-9]/g, ''))}
                        mode="outlined"
                        keyboardType="numeric"
                        style={styles.dialogInput}
                        disabled={savingAccount}
                      />

                      <TextInput
                        label="Fecha Fin de la Cuota (AAAA-MM-DD)"
                        value={installmentEndDate}
                        onChangeText={setInstallmentEndDate}
                        mode="outlined"
                        placeholder="Ej: 2027-12-31"
                        style={styles.dialogInput}
                        disabled={savingAccount}
                      />
                      <HelperText type="info" visible={!selectedAccount}>
                        Se crearán de una sola vez todas las cuotas entre hoy y esta fecha.
                      </HelperText>

                      <Text style={[theme.typography.caption, { marginBottom: 4, color: theme.customColors.textSecondary }]}>
                        Debitar de la Cuenta:
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginVertical: 4 }}>
                        {accounts.filter(a => a.type !== 'credit_card' && a.id !== selectedAccount?.id).map((a) => (
                          <Button
                            key={a.id}
                            mode={installmentSourceAccountId === a.id ? 'contained' : 'outlined'}
                            compact
                            style={{ marginRight: 8, borderRadius: 8, marginBottom: 4 }}
                            onPress={() => setInstallmentSourceAccountId(a.id)}
                            disabled={savingAccount}
                            labelStyle={{ fontSize: 11 }}
                          >
                            {a.name}
                          </Button>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
              {/* Opción de Cuenta Privada (Solo visible para ti) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.outline + '20' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[theme.typography.body, { fontWeight: '600', color: theme.colors.onSurface }]}>
                    Cuenta Privada
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                    Ocultar del patrimonio familiar (solo visible para ti)
                  </Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  color={theme.colors.primary}
                  disabled={savingAccount}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button
              onPress={() => setIsDialogVisible(false)}
              textColor={theme.customColors.textSecondary}
              disabled={savingAccount}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveAccount}
              loading={savingAccount}
              disabled={savingAccount || !accountName.trim()}
              style={{ marginLeft: 8 }}
            >
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
