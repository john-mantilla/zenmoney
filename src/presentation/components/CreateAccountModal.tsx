/**
 * ZenMoney — Modal para Crear/Editar Cuentas y Deudas (Impeccable.style)
 *
 * Ofrece una interfaz responsive para web y móvil (tarjeta centrada en web),
 * selección de tipos de cuenta, paleta de colores de marca, campos condicionales
 * de cuota/días de corte y soporte para cuentas privadas.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Modal, Pressable, Platform, TouchableWithoutFeedback } from 'react-native';
import { Surface, Text, Button, TextInput, Switch, IconButton, HelperText } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/presentation/theme';
import { Account, AccountType } from '@/src/domain/entities/Account';
import { getAccountBrandInfo } from '@/src/presentation/theme/accountBrands';

export interface CreateAccountData {
  name: string;
  type: AccountType;
  initialBalance: number;
  color?: string;
  icon?: string;
  closingDay?: number;
  paymentDay?: number;
  isPrivate?: boolean;
  hasInstallment?: boolean;
  installmentAmount?: number;
  installmentEndDate?: string;
  installmentSourceAccountId?: string;
}

interface CreateAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateAccountData) => Promise<void>;
  editingAccount?: Account | null;
  accounts?: Account[];
}

const ACCOUNT_TYPES: { type: AccountType; label: string; icon: string }[] = [
  { type: 'bank', label: 'Ahorro / Corriente', icon: 'bank' },
  { type: 'credit_card', label: 'Tarjeta de Crédito', icon: 'credit-card' },
  { type: 'cash', label: 'Efectivo', icon: 'cash' },
  { type: 'loan', label: 'Préstamo / Deuda', icon: 'bank-transfer-out' },
  { type: 'investment', label: 'Inversión / CDT', icon: 'chart-line' },
];

const BRAND_COLORS = [
  { name: 'Bancolombia', color: '#FCD34D' },
  { name: 'Nequi', color: '#EC4899' },
  { name: 'Davivienda', color: '#EF4444' },
  { name: 'Nu', color: '#8B5CF6' },
  { name: 'RappiCard', color: '#F97316' },
  { name: 'Lulo Bank', color: '#10B981' },
  { name: 'Falabella', color: '#059669' },
  { name: 'BBVA', color: '#2563EB' },
  { name: 'Azul Noche', color: '#1E293B' },
  { name: 'Gris Grafito', color: '#64748B' },
];

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  visible,
  onClose,
  onSave,
  editingAccount,
  accounts = [],
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [accountColor, setAccountColor] = useState<string>('');
  const [accountIcon, setAccountIcon] = useState<string>('');
  const [initialBalanceInput, setInitialBalanceInput] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [hasInstallment, setHasInstallment] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [installmentEndDate, setInstallmentEndDate] = useState('');
  const [installmentSourceAccountId, setInstallmentSourceAccountId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingAccount) {
      setAccountName(editingAccount.name);
      setAccountType(editingAccount.type);
      setAccountColor(editingAccount.color || '');
      setAccountIcon(editingAccount.icon || '');
      setInitialBalanceInput(String(editingAccount.initialBalance || '0'));
      setClosingDay(editingAccount.closingDay ? String(editingAccount.closingDay) : '');
      setPaymentDay(editingAccount.paymentDay ? String(editingAccount.paymentDay) : '');
      setIsPrivate(!!editingAccount.isPrivate);
    } else {
      setAccountName('');
      setAccountType('bank');
      setAccountColor('');
      setAccountIcon('');
      setInitialBalanceInput('');
      setClosingDay('');
      setPaymentDay('');
      setIsPrivate(false);
      setHasInstallment(false);
      setInstallmentAmount('');
      setInstallmentEndDate('');
      setInstallmentSourceAccountId('');
    }
    setErrorMsg(null);
  }, [editingAccount, visible]);

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_) {}
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      setErrorMsg('Por favor ingresa un nombre para la cuenta.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const balance = parseFloat(initialBalanceInput.replace(/[^0-9.-]/g, '')) || 0;
      await onSave({
        name: accountName.trim(),
        type: accountType,
        initialBalance: balance,
        color: accountColor || undefined,
        icon: accountIcon || undefined,
        closingDay: closingDay ? parseInt(closingDay, 10) : undefined,
        paymentDay: paymentDay ? parseInt(paymentDay, 10) : undefined,
        isPrivate,
        hasInstallment,
        installmentAmount: installmentAmount ? parseFloat(installmentAmount) : undefined,
        installmentEndDate: installmentEndDate || undefined,
        installmentSourceAccountId: installmentSourceAccountId || undefined,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la cuenta.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeColor = accountColor || theme.colors.primary;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Surface
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.colors.surface,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
              elevation={5}
            >
              {/* Handle Bar */}
              <View style={styles.dragHandleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: theme.colors.outline + '40' }]} />
              </View>

              {/* Header Row */}
              <View style={styles.headerRow}>
                <View style={styles.headerTitleContainer}>
                  <View style={[styles.headerIconBadge, { backgroundColor: activeColor + '20' }]}>
                    <MaterialCommunityIcons name="bank-outline" size={24} color={activeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                      {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta o Deuda'}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      Bancos, tarjetas de crédito, préstamos y efectivo
                    </Text>
                  </View>
                </View>
                <IconButton icon="close" size={20} onPress={onClose} style={{ margin: 0 }} />
              </View>

              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {errorMsg && (
                  <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
                    <Text style={{ color: theme.colors.onErrorContainer, fontSize: 12, fontWeight: '600' }}>
                      {errorMsg}
                    </Text>
                  </View>
                )}

                {/* Nombre de la Cuenta */}
                <TextInput
                  label="Nombre de la cuenta (ej: Bancolombia, Nequi, Nu)"
                  value={accountName}
                  onChangeText={setAccountName}
                  mode="outlined"
                  style={styles.input}
                  disabled={isSaving}
                />

                {/* Tipo de Cuenta (Pills) */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  TIPO DE CUENTA
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {ACCOUNT_TYPES.map((t) => {
                    const isSelected = accountType === t.type;
                    return (
                      <Pressable
                        key={t.type}
                        onPress={() => {
                          triggerHaptic();
                          setAccountType(t.type);
                        }}
                        style={[
                          styles.typePill,
                          {
                            borderColor: isSelected ? theme.colors.primary : theme.colors.outline + '30',
                            backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={t.icon as any}
                          size={18}
                          color={isSelected ? theme.colors.primary : theme.customColors.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                            fontWeight: isSelected ? '700' : '500',
                          }}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Color de Marca */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  COLOR DE MARCA
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {BRAND_COLORS.map((c) => {
                    const isSelected = accountColor.toLowerCase() === c.color.toLowerCase();
                    return (
                      <Pressable
                        key={c.color}
                        onPress={() => {
                          triggerHaptic();
                          setAccountColor(c.color);
                        }}
                        style={[
                          styles.colorCircle,
                          {
                            backgroundColor: c.color,
                            borderColor: isSelected ? theme.colors.primary : '#FFFFFF',
                            borderWidth: isSelected ? 3 : 1,
                          },
                        ]}
                      >
                        {isSelected && <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />}
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Saldo Inicial */}
                {!editingAccount && (
                  <TextInput
                    label="Saldo Inicial ($ COP)"
                    value={initialBalanceInput}
                    onChangeText={(txt) => setInitialBalanceInput(txt.replace(/[^0-9.-]/g, ''))}
                    mode="outlined"
                    keyboardType="numeric"
                    placeholder="0"
                    style={styles.input}
                    disabled={isSaving}
                  />
                )}

                {/* Campos para Tarjeta de Crédito */}
                {accountType === 'credit_card' && (
                  <View style={styles.fieldsGroup}>
                    <TextInput
                      label="Día de corte de facturación (1 - 31)"
                      value={closingDay}
                      onChangeText={(txt) => setClosingDay(txt.replace(/[^0-9]/g, ''))}
                      mode="outlined"
                      keyboardType="numeric"
                      placeholder="15"
                      style={styles.input}
                      disabled={isSaving}
                    />
                    <TextInput
                      label="Día límite de pago (1 - 31)"
                      value={paymentDay}
                      onChangeText={(txt) => setPaymentDay(txt.replace(/[^0-9]/g, ''))}
                      mode="outlined"
                      keyboardType="numeric"
                      placeholder="2"
                      style={styles.input}
                      disabled={isSaving}
                    />
                  </View>
                )}

                {/* Campos para Préstamo */}
                {['loan', 'mortgage'].includes(accountType) && (
                  <TextInput
                    label="Día de pago de la cuota (1 - 31)"
                    value={paymentDay}
                    onChangeText={(txt) => setPaymentDay(txt.replace(/[^0-9]/g, ''))}
                    mode="outlined"
                    keyboardType="numeric"
                    placeholder="5"
                    style={styles.input}
                    disabled={isSaving}
                  />
                )}

                {/* Toggle Cuenta Privada */}
                <View style={[styles.switchRow, { borderColor: theme.colors.outline + '20' }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[theme.typography.body, { fontWeight: '600', color: theme.colors.onSurface }]}>
                      Cuenta Privada 🙈
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      Ocultar del patrimonio familiar (solo visible para ti)
                    </Text>
                  </View>
                  <Switch value={isPrivate} onValueChange={setIsPrivate} color={theme.colors.primary} disabled={isSaving} />
                </View>

                {/* Botón de Acción Principal */}
                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={isSaving}
                  disabled={isSaving || !accountName.trim()}
                  style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  {editingAccount ? 'Guardar Cambios' : 'Crear Cuenta'}
                </Button>
              </ScrollView>
            </Surface>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  modalCard: {
    borderRadius: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 620 : '100%',
    maxHeight: Platform.OS === 'web' ? ('85vh' as any) : '90%',
    paddingHorizontal: 20,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  input: {
    marginBottom: 14,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 8,
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldsGroup: {
    gap: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  errorBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  saveBtn: {
    borderRadius: 14,
    marginTop: 8,
  },
});
