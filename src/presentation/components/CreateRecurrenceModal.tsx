/**
 * ZenMoney — CreateRecurrenceModal Component
 * 
 * Modal BottomSheet moderno e interactivo para gestionar reglas de Ingresos y Gastos Recurrentes.
 * Construido según las especificaciones de Impeccable.style (Dark/Light mode, Plus Jakarta Sans, Haptics, Web-ready).
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
import { Account } from '@/src/domain/entities/Account';
import { Category } from '@/src/domain/entities/Category';
import { RecurringRule, FrequencyType } from '@/src/domain/entities/RecurringRule';

interface CreateRecurrenceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    description: string;
    amount: number;
    type: 'income' | 'expense';
    frequency: FrequencyType;
    dayOfMonth?: number;
    startDate: string;
    endDate?: string;
    accountId: string;
    categoryId?: string;
  }) => Promise<void>;
  editingRule?: RecurringRule | null;
  accounts: Account[];
  categories: Category[];
}

export const CreateRecurrenceModal: React.FC<CreateRecurrenceModalProps> = ({
  visible,
  onClose,
  onSave,
  editingRule,
  accounts,
  categories,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  // Estados del Formulario
  const [recType, setRecType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Estados de UI
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const activeAccounts = accounts.filter((a) => a.isActive);
  const expenseCategories = categories.filter((c) => !c.name.toLowerCase().includes('ingreso'));
  const incomeCategories = categories.filter(
    (c) => c.name.toLowerCase().includes('ingreso') || c.name.toLowerCase().includes('salario')
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const parentCategories = expenseCategories.filter((c) => !c.parentCategoryId);
  const getSubcategories = (parentId: string) => expenseCategories.filter((c) => c.parentCategoryId === parentId);

  useEffect(() => {
    if (visible) {
      setErrorMsg(null);
      setShowCategoryDropdown(false);
      const todayStr = getTodayDateString();

      if (editingRule) {
        setRecType(editingRule.type);
        setDescription(editingRule.description || '');
        setAmount(editingRule.amount ? String(editingRule.amount) : '');
        setFrequency(editingRule.frequency);
        setDayOfMonth(editingRule.dayOfMonth ? String(editingRule.dayOfMonth) : '5');
        setStartDate(editingRule.startDate || todayStr);
        setEndDate(editingRule.endDate || '');
        setAccountId(editingRule.accountId || (activeAccounts[0]?.id || ''));
        setCategoryId(editingRule.categoryId || (editingRule.type === 'expense' ? expenseCategories[0]?.id || '' : incomeCategories[0]?.id || ''));
      } else {
        setRecType('expense');
        setDescription('');
        setAmount('');
        setFrequency('monthly');
        setDayOfMonth('5');
        setStartDate(todayStr);
        setEndDate('');
        setAccountId(activeAccounts[0]?.id || '');
        setCategoryId(expenseCategories[0]?.id || '');
      }
    }
  }, [visible, editingRule, accounts, categories]);

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
      setErrorMsg('Por favor ingresa una descripción (ej. Salario, Arriendo).');
      return;
    }
    if (!startDate) {
      setErrorMsg('Por favor selecciona la fecha de inicio.');
      return;
    }
    if (!accountId) {
      setErrorMsg('Por favor selecciona una cuenta activa.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: numAmount,
        type: recType,
        frequency,
        dayOfMonth: frequency === 'monthly' ? (parseInt(dayOfMonth, 10) || 1) : undefined,
        startDate,
        endDate: endDate.trim() ? endDate : undefined,
        accountId,
        categoryId: recType === 'expense' ? categoryId : (incomeCategories[0]?.id || categoryId),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la recurrencia.');
    } finally {
      setSaving(false);
    }
  };

  const getFrequencyLabel = (f: FrequencyType) => {
    switch (f) {
      case 'daily': return 'Diaria';
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      case 'yearly': return 'Anual';
      default: return f;
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Sin fecha límite';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
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
                    <View
                      style={[
                        styles.iconBadge,
                        {
                          backgroundColor: recType === 'expense' ? theme.customColors.dangerLight : theme.customColors.successLight,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={recType === 'expense' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                        size={24}
                        color={recType === 'expense' ? theme.customColors.expense : theme.customColors.income}
                      />
                    </View>
                    <View>
                      <Text style={[styles.headerTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
                        {editingRule ? 'Editar Recurrencia' : 'Nueva Recurrencia'}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                        Programa tus ingresos o gastos periódicos
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
                  {/* Selector de Tipo (Gasto vs Ingreso) */}
                  <View style={styles.typeSelectorRow}>
                    <Pressable
                      style={[
                        styles.typePill,
                        recType === 'expense' && [
                          styles.typePillActive,
                          { backgroundColor: theme.customColors.dangerLight, borderColor: theme.customColors.expense },
                        ],
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setRecType('expense');
                        if (!categoryId && expenseCategories.length > 0) {
                          setCategoryId(expenseCategories[0].id);
                        }
                      }}
                    >
                      <MaterialCommunityIcons
                        name="arrow-up-circle-outline"
                        size={18}
                        color={recType === 'expense' ? theme.customColors.expense : theme.customColors.textSecondary}
                      />
                      <Text
                        style={[
                          theme.typography.button,
                          {
                            fontSize: 13,
                            color: recType === 'expense' ? theme.customColors.expense : theme.customColors.textSecondary,
                            fontWeight: recType === 'expense' ? '700' : '500',
                          },
                        ]}
                      >
                        Gasto Recurrente
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.typePill,
                        recType === 'income' && [
                          styles.typePillActive,
                          { backgroundColor: theme.customColors.successLight, borderColor: theme.customColors.income },
                        ],
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setRecType('income');
                        if (incomeCategories.length > 0) {
                          setCategoryId(incomeCategories[0].id);
                        }
                      }}
                    >
                      <MaterialCommunityIcons
                        name="arrow-down-circle-outline"
                        size={18}
                        color={recType === 'income' ? theme.customColors.income : theme.customColors.textSecondary}
                      />
                      <Text
                        style={[
                          theme.typography.button,
                          {
                            fontSize: 13,
                            color: recType === 'income' ? theme.customColors.income : theme.customColors.textSecondary,
                            fontWeight: recType === 'income' ? '700' : '500',
                          },
                        ]}
                      >
                        Ingreso Recurrente
                      </Text>
                    </Pressable>
                  </View>

                  {/* Campo de Monto Monetario Destacado (Plus Jakarta Sans) */}
                  <View style={[styles.amountContainer, { backgroundColor: theme.colors.surfaceVariant + '80' }]}>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 4 }]}>
                      MONTO FIJO PERIÓDICO
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
                        style={[styles.amountTextInput, theme.typography.amountLarge, { color: theme.colors.onSurface }]}
                        textColor={theme.colors.onSurface}
                      />
                    </View>
                  </View>

                  {/* Descripción */}
                  <View style={styles.inputGroup}>
                    <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                      DESCRIPCIÓN
                    </Text>
                    <TextInput
                      value={description}
                      onChangeText={(txt) => {
                        setDescription(txt);
                        setErrorMsg(null);
                      }}
                      placeholder={recType === 'income' ? 'Ej: Salario Mensual, Nomina' : 'Ej: Arriendo, Suscripción Netflix'}
                      mode="outlined"
                      outlineColor={theme.colors.outline + '40'}
                      activeOutlineColor={theme.colors.primary}
                      style={styles.outlinedInput}
                      left={<TextInput.Icon icon="pencil-outline" color={theme.colors.primary} />}
                    />
                  </View>

                  {/* Selección de Frecuencia */}
                  <View style={styles.inputGroup}>
                    <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                      FRECUENCIA DE REPETICIÓN
                    </Text>
                    <View style={styles.chipGrid}>
                      {(['daily', 'weekly', 'biweekly', 'monthly', 'yearly'] as const).map((f) => {
                        const isSelected = frequency === f;
                        return (
                          <Pressable
                            key={f}
                            onPress={() => {
                              triggerHaptic();
                              setFrequency(f);
                            }}
                            style={[
                              styles.chipItem,
                              {
                                borderColor: isSelected ? theme.colors.primary : theme.colors.outline + '30',
                                backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                theme.typography.bodySmall,
                                {
                                  color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                                  fontWeight: isSelected ? '700' : '500',
                                },
                              ]}
                            >
                              {getFrequencyLabel(f)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Día del mes si la frecuencia es Mensual */}
                  {frequency === 'monthly' && (
                    <View style={styles.inputGroup}>
                      <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                        DÍA DE COBRO / DÉBITO EN EL MES (1 - 31)
                      </Text>
                      <TextInput
                        value={dayOfMonth}
                        onChangeText={(txt) => {
                          const num = parseInt(txt.replace(/[^0-9]/g, ''), 10) || '';
                          setDayOfMonth(num === '' ? '' : String(Math.min(31, Math.max(1, Number(num)))));
                        }}
                        keyboardType="numeric"
                        mode="outlined"
                        outlineColor={theme.colors.outline + '40'}
                        activeOutlineColor={theme.colors.primary}
                        style={styles.outlinedInput}
                        left={<TextInput.Icon icon="calendar-today" color={theme.colors.primary} />}
                      />
                    </View>
                  )}

                  {/* Fechas de Inicio y Fin */}
                  <View style={styles.dateRowContainer}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                        FECHA INICIO
                      </Text>
                      {Platform.OS === 'web' ? (
                        <View style={[styles.webDatePickerBox, { borderColor: theme.colors.outline + '40' }]}>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{
                              border: 'none',
                              outline: 'none',
                              backgroundColor: 'transparent',
                              fontFamily: 'inherit',
                              fontSize: 14,
                              color: theme.colors.onSurface,
                              width: '100%',
                            }}
                          />
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.dateSelectorBtn, { borderColor: theme.colors.outline + '40' }]}
                          onPress={() => setShowStartDatePicker(true)}
                        >
                          <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurface }]}>
                            {formatDateDisplay(startDate)}
                          </Text>
                        </Pressable>
                      )}
                      {showStartDatePicker && Platform.OS !== 'web' && (
                        <DateTimePicker
                          value={(() => {
                            const parts = startDate.split('-');
                            return parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date();
                          })()}
                          mode="date"
                          display="default"
                          onChange={(e: DateTimePickerEvent, selected?: Date) => {
                            setShowStartDatePicker(false);
                            if (selected && e.type === 'set') {
                              const y = selected.getFullYear();
                              const m = String(selected.getMonth() + 1).padStart(2, '0');
                              const d = String(selected.getDate()).padStart(2, '0');
                              setStartDate(`${y}-${m}-${d}`);
                            }
                          }}
                        />
                      )}
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                        FECHA FIN (OPCIONAL)
                      </Text>
                      {Platform.OS === 'web' ? (
                        <View style={[styles.webDatePickerBox, { borderColor: theme.colors.outline + '40' }]}>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{
                              border: 'none',
                              outline: 'none',
                              backgroundColor: 'transparent',
                              fontFamily: 'inherit',
                              fontSize: 14,
                              color: theme.colors.onSurface,
                              width: '100%',
                            }}
                          />
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.dateSelectorBtn, { borderColor: theme.colors.outline + '40' }]}
                          onPress={() => setShowEndDatePicker(true)}
                        >
                          <Text style={[theme.typography.bodySmall, { color: endDate ? theme.colors.onSurface : theme.customColors.textTertiary }]}>
                            {formatDateDisplay(endDate)}
                          </Text>
                        </Pressable>
                      )}
                      {showEndDatePicker && Platform.OS !== 'web' && (
                        <DateTimePicker
                          value={(() => {
                            const parts = endDate.split('-');
                            return parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date();
                          })()}
                          mode="date"
                          display="default"
                          onChange={(e: DateTimePickerEvent, selected?: Date) => {
                            setShowEndDatePicker(false);
                            if (selected && e.type === 'set') {
                              const y = selected.getFullYear();
                              const m = String(selected.getMonth() + 1).padStart(2, '0');
                              const d = String(selected.getDate()).padStart(2, '0');
                              setEndDate(`${y}-${m}-${d}`);
                            }
                          }}
                        />
                      )}
                    </View>
                  </View>

                  {/* Selección de Cuenta */}
                  <View style={styles.inputGroup}>
                    <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                      {recType === 'income' ? 'CUENTA QUE RECIBE' : 'CUENTA DE PAGO'}
                    </Text>
                    <View style={styles.chipGrid}>
                      {activeAccounts.map((acc) => {
                        const isSelected = accountId === acc.id;
                        return (
                          <Pressable
                            key={acc.id}
                            onPress={() => {
                              triggerHaptic();
                              setAccountId(acc.id);
                            }}
                            style={[
                              styles.chipItem,
                              {
                                borderColor: isSelected ? theme.colors.primary : theme.colors.outline + '30',
                                backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                theme.typography.bodySmall,
                                {
                                  color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                                  fontWeight: isSelected ? '700' : '400',
                                },
                              ]}
                            >
                              {acc.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Selección de Categoría (Gasto) */}
                  {recType === 'expense' && (
                    <View style={styles.inputGroup}>
                      <Text style={[theme.typography.label, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                        CATEGORÍA DE GASTO
                      </Text>
                      
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

                      {showCategoryDropdown && (
                        <Surface
                          style={[
                            styles.categoryDropdownContainer,
                            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '30' },
                          ]}
                          elevation={2}
                        >
                          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                            {parentCategories.map((parent) => {
                              const subcats = getSubcategories(parent.id);
                              const isParentSelected = categoryId === parent.id;
                              return (
                                <View key={parent.id} style={styles.categoryGroupItem}>
                                  <Pressable
                                    style={[
                                      styles.categoryRowItem,
                                      isParentSelected && { backgroundColor: theme.colors.primary + '15' },
                                    ]}
                                    onPress={() => {
                                      triggerHaptic();
                                      setCategoryId(parent.id);
                                      setShowCategoryDropdown(false);
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
                  )}

                  {/* Acciones */}
                  <View style={styles.actionsContainer}>
                    <Button
                      mode="outlined"
                      onPress={onClose}
                      textColor={theme.customColors.textSecondary}
                      style={{ borderRadius: 12, borderColor: theme.colors.outline + '40' }}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleSave}
                      loading={saving}
                      disabled={saving || !amount || !description.trim() || !accountId}
                      style={[styles.saveBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                      labelStyle={{ fontSize: 15, fontWeight: '700', paddingVertical: 2 }}
                      icon="check-circle-outline"
                    >
                      {editingRule ? 'Guardar Cambios' : 'Crear Recurrencia'}
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  dateRowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  webDatePickerBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateSelectorBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 4,
  },
});
