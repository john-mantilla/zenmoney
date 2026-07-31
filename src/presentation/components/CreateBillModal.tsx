/**
 * ZenMoney — CreateBillModal Component
 * 
 * Modal BottomSheet interactivo de alto impacto visual diseñado según los principios de Impeccable.style.
 * Permite agendar y editar facturas, obligaciones periódicas y pagos de tarjetas de crédito.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Surface, TextInput, Button, HelperText, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { CategoryPickerMenu } from './CategoryPickerMenu';
import { Account } from '@/src/domain/entities/Account';
import { Category } from '@/src/domain/entities/Category';
import { Transaction } from '@/src/domain/entities/Transaction';

interface CreateBillModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    description: string;
    amount: number;
    date: string;
    accountId: string;
    categoryId?: string;
    type: 'expense' | 'transfer';
    transferToAccountId?: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  editingBill?: Transaction | null;
  accounts: Account[];
  categories: Category[];
}

export const CreateBillModal: React.FC<CreateBillModalProps> = ({
  visible,
  onClose,
  onSave,
  onDelete,
  editingBill,
  accounts,
  categories,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  // Estados del Formulario
  const [billType, setBillType] = useState<'expense' | 'transfer'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  
  // Estados de UI y control
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Filtrado de categorías para gastos
  const expenseCategories = categories.filter((c) => !c.name.toLowerCase().includes('ingreso'));
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const parentCategories = expenseCategories.filter((c) => !c.parentCategoryId);
  const getSubcategories = (parentId: string) => expenseCategories.filter((c) => c.parentCategoryId === parentId);

  useEffect(() => {
    if (visible) {
      setErrorMsg(null);
      if (editingBill) {
        setBillType(editingBill.type === 'transfer' ? 'transfer' : 'expense');
        setDescription(editingBill.description || '');
        setAmount(editingBill.amount ? String(editingBill.amount) : '');
        setDate(editingBill.aiMetadata?.dueDate || editingBill.transactionDate || getTodayDateString());
        setAccountId(editingBill.accountId || (accounts[0]?.id || ''));
        setCategoryId(editingBill.categoryId || '');
        setTransferToAccountId((editingBill.aiMetadata as any)?.toAccountId || '');
      } else {
        setBillType('expense');
        setDescription('');
        setAmount('');
        setDate(getTodayDateString());
        setAccountId(accounts[0]?.id || '');
        setCategoryId(categories[0]?.id || '');
        setTransferToAccountId('');
      }
    }
  }, [visible, editingBill, accounts, categories]);

  function getTodayDateString(): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_) {}
  };

  const handleSave = async () => {
    triggerHaptic();
    const numAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor a 0.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Por favor ingresa una descripción para la factura.');
      return;
    }
    if (!date) {
      setErrorMsg('Por favor selecciona la fecha de vencimiento.');
      return;
    }
    if (billType === 'expense' && !categoryId) {
      setErrorMsg('Por favor selecciona una categoría de gasto.');
      return;
    }
    if (billType === 'transfer' && !transferToAccountId) {
      setErrorMsg('Por favor selecciona la cuenta o tarjeta a pagar.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: numAmount,
        date,
        accountId,
        categoryId: billType === 'expense' ? categoryId : undefined,
        type: billType,
        transferToAccountId: billType === 'transfer' ? transferToAccountId : undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ocurrió un error al guardar la factura.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    triggerHaptic();
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al eliminar la factura.');
    } finally {
      setDeleting(false);
    }
  };

  // Cuentas elegibles para pago de tarjeta o préstamo
  const creditAccounts = accounts.filter(a => ['credit_card', 'loan', 'mortgage'].includes(a.type));

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Seleccionar fecha';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Surface
                style={[
                  styles.sheetContainer,
                  {
                    backgroundColor: theme.colors.surface,
                    paddingBottom: Math.max(insets.bottom, 20),
                  },
                ]}
                elevation={5}
              >
                {/* Drag Handle Bar */}
                <View style={styles.dragHandleContainer}>
                  <View style={[styles.dragHandle, { backgroundColor: theme.colors.outline + '40' }]} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerTitleRow}>
                    <View style={[
                      styles.iconBadge,
                      { backgroundColor: billType === 'expense' ? theme.customColors.dangerLight : '#EBF5FF' }
                    ]}>
                      <MaterialCommunityIcons
                        name={editingBill ? 'file-document-edit-outline' : 'receipt-text-outline'}
                        size={22}
                        color={billType === 'expense' ? theme.customColors.expense : theme.customColors.transfer}
                      />
                    </View>
                    <View>
                      <Text style={[styles.headerTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
                        {editingBill ? 'Editar Factura' : 'Registrar Nueva Factura'}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                        Agenda tus próximos compromisos de pago
                      </Text>
                    </View>
                  </View>
                  <IconButton icon="close" size={20} onPress={onClose} style={styles.closeBtn} />
                </View>

                {errorMsg && (
                  <HelperText type="error" visible={true} style={styles.errorText}>
                    {errorMsg}
                  </HelperText>
                )}

                <ScrollView
                  style={{ flexShrink: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Selector de Tipo de Factura (Pills Impeccable) */}
                  <View style={styles.typeSelectorRow}>
                    <Pressable
                      style={[
                        styles.typePill,
                        billType === 'expense' && [
                          styles.typePillActive,
                          { backgroundColor: theme.customColors.dangerLight, borderColor: theme.customColors.expense }
                        ],
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setBillType('expense');
                      }}
                    >
                      <MaterialCommunityIcons
                        name="receipt-text-outline"
                        size={18}
                        color={billType === 'expense' ? theme.customColors.expense : theme.customColors.textSecondary}
                      />
                      <Text
                        style={[
                          theme.typography.button,
                          {
                            fontSize: 13,
                            color: billType === 'expense' ? theme.customColors.expense : theme.customColors.textSecondary,
                            fontWeight: billType === 'expense' ? '700' : '500',
                          },
                        ]}
                      >
                        Gasto / Servicio
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.typePill,
                        billType === 'transfer' && [
                          styles.typePillActive,
                          { backgroundColor: '#EBF5FF', borderColor: theme.customColors.transfer }
                        ],
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setBillType('transfer');
                      }}
                    >
                      <MaterialCommunityIcons
                        name="credit-card-outline"
                        size={18}
                        color={billType === 'transfer' ? theme.customColors.transfer : theme.customColors.textSecondary}
                      />
                      <Text
                        style={[
                          theme.typography.button,
                          {
                            fontSize: 13,
                            color: billType === 'transfer' ? theme.customColors.transfer : theme.customColors.textSecondary,
                            fontWeight: billType === 'transfer' ? '700' : '500',
                          },
                        ]}
                      >
                        Pago Tarjeta / Crédito
                      </Text>
                    </Pressable>
                  </View>

                  {/* Campo de Monto Monetario Destacado (Plus Jakarta Sans) */}
                  <View style={[styles.amountContainer, { backgroundColor: theme.colors.surfaceVariant + '80' }]}>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 4 }]}>
                      MONTO A PAGAR
                    </Text>
                    <View style={styles.amountInputRow}>
                      <Text style={[theme.typography.amountLarge, { color: theme.colors.primary, marginRight: 6 }]}>
                        $
                      </Text>
                      <TextInput
                        value={amount}
                        onChangeText={(txt) => {
                          setAmount(txt.replace(/[^0-9.]/g, ''));
                          setErrorMsg(null);
                        }}
                        placeholder="0.00"
                        keyboardType="numeric"
                        mode="flat"
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        style={[
                          styles.amountTextInput,
                          theme.typography.amountLarge,
                          { color: theme.colors.onSurface }
                        ]}
                        textColor={theme.colors.onSurface}
                      />
                    </View>
                  </View>

                  {/* Campo Descripción */}
                  <View style={styles.inputGroup}>
                    <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                      DESCRIPCIÓN DE LA FACTURA
                    </Text>
                    <TextInput
                      value={description}
                      onChangeText={(txt) => {
                        setDescription(txt);
                        setErrorMsg(null);
                      }}
                      placeholder="Ej: Recibo de la Luz, Internet Claro, Cuota Carro"
                      mode="outlined"
                      outlineColor={theme.colors.outline + '40'}
                      activeOutlineColor={theme.colors.primary}
                      style={styles.outlinedInput}
                      left={<TextInput.Icon icon="pencil-outline" color={theme.colors.primary} />}
                    />
                  </View>

                  {/* Selector de Fecha de Vencimiento */}
                  <View style={styles.inputGroup}>
                    <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                      FECHA DE VENCIMIENTO
                    </Text>
                    {Platform.OS === 'web' ? (
                      <View style={[styles.webDatePickerBox, { borderColor: theme.colors.outline + '40' }]}>
                        <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => {
                            setDate(e.target.value);
                            setErrorMsg(null);
                          }}
                          style={{
                            border: 'none',
                            outline: 'none',
                            backgroundColor: 'transparent',
                            fontFamily: 'inherit',
                            fontSize: 15,
                            color: theme.colors.onSurface,
                            width: '100%',
                          }}
                        />
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.dateSelectorBtn, { borderColor: theme.colors.outline + '40', backgroundColor: theme.colors.surface }]}
                        onPress={() => {
                          triggerHaptic();
                          setShowDatePicker(true);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                          <Text style={[theme.typography.body, { color: date ? theme.colors.onSurface : theme.customColors.textTertiary }]}>
                            {formatDateDisplay(date)}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={theme.customColors.textSecondary} />
                      </Pressable>
                    )}

                    {showDatePicker && Platform.OS !== 'web' && (
                      <DateTimePicker
                        value={(() => {
                          const parts = date.split('-');
                          if (parts.length === 3) {
                            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          }
                          return new Date();
                        })()}
                        mode="date"
                        display="default"
                        onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                          setShowDatePicker(false);
                          if (selectedDate && event.type === 'set') {
                            const year = selectedDate.getFullYear();
                            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const day = String(selectedDate.getDate()).padStart(2, '0');
                            setDate(`${year}-${month}-${day}`);
                            setErrorMsg(null);
                          }
                        }}
                      />
                    )}
                  </View>

                  {/* Selector Dinámico: Categoría (Gasto) vs Cuenta Destino (Transferencia) */}
                  {billType === 'expense' ? (
                    <View style={styles.inputGroup}>
                      <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                        CATEGORÍA DE GASTO
                      </Text>
                      
                      {/* Botón Encabezado de la Categoría Seleccionada */}
                      <Pressable
                        style={[
                          styles.categorySelectBtn,
                          {
                            borderColor: showCategoryDropdown ? theme.colors.primary : theme.colors.outline + '40',
                            backgroundColor: theme.colors.surface,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic();
                          setShowCategoryDropdown(!showCategoryDropdown);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons
                            name={(selectedCategory?.icon as any) || 'tag-outline'}
                            size={20}
                            color={selectedCategory?.color || theme.colors.primary}
                            style={{ marginRight: 10 }}
                          />
                          <Text style={[theme.typography.body, { color: theme.colors.onSurface, fontWeight: '600' }]}>
                            {selectedCategory?.name || 'Seleccionar Categoría'}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.customColors.textSecondary}
                        />
                      </Pressable>

                      {/* Acordeón / Desplegable de Categorías en línea */}
                      {showCategoryDropdown && (
                        <Surface
                          style={[
                            styles.categoryDropdownContainer,
                            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '30' },
                          ]}
                          elevation={2}
                        >
                          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                            {parentCategories.map((parent) => {
                              const subcats = getSubcategories(parent.id);
                              const isParentSelected = categoryId === parent.id;
                              return (
                                <View key={parent.id} style={styles.categoryGroupItem}>
                                  {/* Categoría Principal */}
                                  <Pressable
                                    style={[
                                      styles.categoryRowItem,
                                      isParentSelected && { backgroundColor: theme.colors.primary + '15' },
                                    ]}
                                    onPress={() => {
                                      triggerHaptic();
                                      setCategoryId(parent.id);
                                      setShowCategoryDropdown(false);
                                      setErrorMsg(null);
                                    }}
                                  >
                                    <MaterialCommunityIcons
                                      name={(parent.icon as any) || 'folder-outline'}
                                      size={18}
                                      color={parent.color || theme.colors.primary}
                                      style={{ marginRight: 8 }}
                                    />
                                    <Text
                                      style={[
                                        theme.typography.bodySmall,
                                        {
                                          color: isParentSelected ? theme.colors.primary : theme.colors.onSurface,
                                          fontWeight: isParentSelected ? '700' : '600',
                                          flex: 1,
                                        },
                                      ]}
                                    >
                                      {parent.name}
                                    </Text>
                                    {isParentSelected && (
                                      <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />
                                    )}
                                  </Pressable>

                                  {/* Subcategorías Anidadas */}
                                  {subcats.map((sub) => {
                                    const isSubSelected = categoryId === sub.id;
                                    return (
                                      <Pressable
                                        key={sub.id}
                                        style={[
                                          styles.categoryRowItem,
                                          { paddingLeft: 32 },
                                          isSubSelected && { backgroundColor: theme.colors.primary + '15' },
                                        ]}
                                        onPress={() => {
                                          triggerHaptic();
                                          setCategoryId(sub.id);
                                          setShowCategoryDropdown(false);
                                          setErrorMsg(null);
                                        }}
                                      >
                                        <MaterialCommunityIcons
                                          name="subdirectory-arrow-right"
                                          size={16}
                                          color={theme.customColors.textSecondary}
                                          style={{ marginRight: 6 }}
                                        />
                                        <Text
                                          style={[
                                            theme.typography.bodySmall,
                                            {
                                              color: isSubSelected ? theme.colors.primary : theme.customColors.textSecondary,
                                              fontWeight: isSubSelected ? '700' : '400',
                                              flex: 1,
                                            },
                                          ]}
                                        >
                                          {sub.name}
                                        </Text>
                                        {isSubSelected && (
                                          <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />
                                        )}
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              );
                            })}
                          </ScrollView>
                        </Surface>
                      )}
                    </View>
                  ) : (
                    <View style={styles.inputGroup}>
                      <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                        TARJETA O CRÉDITO A PAGAR
                      </Text>
                      {creditAccounts.length === 0 ? (
                        <View style={[styles.emptyAccountBanner, { backgroundColor: theme.customColors.warningLight }]}>
                          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.customColors.warning} />
                          <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurface, flex: 1, marginLeft: 8 }]}>
                            No tienes tarjetas de crédito registradas. Agrégalas en Configuración {' > '} Cuentas.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.accountPillContainer}>
                          {creditAccounts.map((acc) => {
                            const isSelected = transferToAccountId === acc.id;
                            return (
                              <Pressable
                                key={acc.id}
                                onPress={() => {
                                  triggerHaptic();
                                  setTransferToAccountId(acc.id);
                                }}
                                style={[
                                  styles.accountCardOption,
                                  {
                                    borderColor: isSelected ? theme.colors.primary : theme.colors.outline + '30',
                                    backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.surface,
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="credit-card-outline"
                                  size={18}
                                  color={isSelected ? theme.colors.primary : theme.customColors.textSecondary}
                                />
                                <Text
                                  style={[
                                    theme.typography.bodySmall,
                                    {
                                      color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                                      fontWeight: isSelected ? '700' : '400',
                                      marginLeft: 6,
                                    },
                                  ]}
                                >
                                  {acc.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Acciones del Botón Infeiror */}
                  <View style={styles.actionsContainer}>
                    {editingBill && onDelete && (
                      <Button
                        mode="outlined"
                        onPress={handleDelete}
                        loading={deleting}
                        disabled={saving || deleting}
                        textColor={theme.colors.error}
                        style={[styles.deleteBtn, { borderColor: theme.colors.error + '50' }]}
                        icon="trash-can-outline"
                      >
                        Eliminar
                      </Button>
                    )}

                    <Button
                      mode="contained"
                      onPress={handleSave}
                      loading={saving}
                      disabled={saving || deleting}
                      style={[
                        styles.saveBtn,
                        {
                          backgroundColor: theme.colors.primary,
                          flex: 1,
                        },
                      ]}
                      labelStyle={{ fontSize: 16, fontWeight: '700', paddingVertical: 4 }}
                      icon="check-circle-outline"
                    >
                      {editingBill ? 'Guardar Cambios' : 'Registrar Factura'}
                    </Button>
                  </View>
                </ScrollView>
              </Surface>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
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
  keyboardContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 620 : '100%',
    alignSelf: 'center',
  },
  sheetContainer: {
    borderRadius: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: Platform.OS === 'web' ? ('85vh' as any) : '90%',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
  },
  closeBtn: {
    margin: 0,
  },
  errorText: {
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  typePillActive: {
    borderWidth: 1.5,
  },
  amountContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountTextInput: {
    backgroundColor: 'transparent',
    fontSize: 32,
    textAlign: 'center',
    minWidth: 120,
    height: 48,
  },
  inputGroup: {
    marginBottom: 16,
  },
  outlinedInput: {
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  webDatePickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  categorySelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  categoryDropdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  categoryGroupItem: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB40',
  },
  categoryRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyAccountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  accountPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  deleteBtn: {
    borderRadius: 12,
    borderWidth: 1,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 4,
  },
});
