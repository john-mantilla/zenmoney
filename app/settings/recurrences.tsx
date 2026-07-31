/**
 * ZenMoney — Gestión de Ingresos y Gastos Recurrentes (Modular)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { Button, Card, Text, ActivityIndicator, Dialog, Portal, TextInput, List, IconButton, Appbar, SegmentedButtons, HelperText } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import { CategoryPickerMenu, CreateRecurrenceModal } from '@/src/presentation/components';
import { SupabaseRecurringRuleRepository } from '@/src/data/repositories/SupabaseRecurringRuleRepository';
import { SupabaseTransactionRepository } from '@/src/data/repositories/SupabaseTransactionRepository';
import { SupabaseAccountRepository } from '@/src/data/repositories/SupabaseAccountRepository';
import { SupabaseCategoryRepository } from '@/src/data/repositories/SupabaseCategoryRepository';
import { GenerateRecurringInstances } from '@/src/domain/usecases/GenerateRecurringInstances';
import { RecurringRule } from '@/src/domain/entities/RecurringRule';
import { Account } from '@/src/domain/entities/Account';
import { Category } from '@/src/domain/entities/Category';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const webStyles = {
  dateInput: {
    width: '100%',
    height: 48,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  } as any,
};

/** Campo de fecha reutilizable: input nativo en web, DateTimePicker en móvil. */
function DateField({
  label,
  value,
  onChange,
  disabled,
  clearable,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.dateFieldWeb}>
        <Text style={styles.dateFieldLabel}>{label}</Text>
        <View style={styles.dateFieldWebRow}>
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={webStyles.dateInput}
            disabled={disabled}
          />
          {clearable && !!value && (
            <IconButton icon="close" size={16} onPress={() => onChange('')} disabled={disabled} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dateFieldNative}>
      <Pressable onPress={() => setShow(true)} disabled={disabled}>
        <View pointerEvents="none">
          <TextInput
            label={label}
            value={value}
            mode="outlined"
            style={styles.dialogInput}
            disabled={disabled}
            right={
              clearable && value ? (
                <TextInput.Icon icon="close" onPress={() => onChange('')} />
              ) : (
                <TextInput.Icon icon="calendar" />
              )
            }
          />
        </View>
      </Pressable>
      {show && (
        <DateTimePicker
          value={(() => {
            if (!value) return new Date();
            const parts = value.split('-');
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          })()}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShow(false);
            if (selectedDate && event.type === 'set') {
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              onChange(`${year}-${month}-${day}`);
            }
          }}
        />
      )}
    </View>
  );
}

export default function SettingsRecurrencesScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Estados de datos
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de diálogo
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [recType, setRecType] = useState<'income' | 'expense'>('expense');
  const [recAmount, setRecAmount] = useState('');
  const [recDescription, setRecDescription] = useState('');
  const [recFrequency, setRecFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'>('monthly');
  const [recDayOfMonth, setRecDayOfMonth] = useState('5');
  const [recAccountId, setRecAccountId] = useState('');
  const [recCategoryId, setRecCategoryId] = useState('');
  const [recStartDate, setRecStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [recEndDate, setRecEndDate] = useState('');
  const [savingRecurrence, setSavingRecurrence] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recurrenceRepo = new SupabaseRecurringRuleRepository();
  const accountRepo = new SupabaseAccountRepository();
  const categoryRepo = new SupabaseCategoryRepository();
  const transactionRepo = new SupabaseTransactionRepository();

  // Solo cuentas activas pueden recibir nuevas recurrencias
  const activeAccounts = accounts.filter((a) => a.isActive);
  const incomeCategories = categories.filter(
    (c) => c.name.toLowerCase().includes('ingreso') || c.name.toLowerCase().includes('salario')
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const loadedAccounts = await accountRepo.getAll();
      setAccounts(loadedAccounts);

      const loadedCategories = await categoryRepo.getAll(true);
      setCategories(loadedCategories);

      const loadedRecs = await recurrenceRepo.getAllActive();
      setRecurringRules(loadedRecs);
    } catch (err) {
      console.error('[Recurrences Settings Screen Load Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const resetDialogFields = () => {
    setEditingRule(null);
    setRecType('expense');
    setRecAmount('');
    setRecDescription('');
    setRecFrequency('monthly');
    setRecDayOfMonth('5');
    setRecStartDate(new Date().toISOString().split('T')[0]);
    setRecEndDate('');
    setErrorMsg(null);
    setRecAccountId(activeAccounts[0]?.id || '');
    setRecCategoryId(categories.find((c) => !c.name.toLowerCase().includes('ingreso'))?.id || '');
  };

  const openCreateDialog = () => {
    resetDialogFields();
    setIsDialogVisible(true);
  };

  const openEditDialog = (rule: RecurringRule) => {
    setEditingRule(rule);
    setRecType(rule.type);
    setRecAmount(String(rule.amount));
    setRecDescription(rule.description || '');
    setRecFrequency(rule.frequency);
    setRecDayOfMonth(rule.dayOfMonth ? String(rule.dayOfMonth) : '5');
    setRecAccountId(rule.accountId);
    setRecCategoryId(rule.categoryId || '');
    setRecStartDate(rule.startDate);
    setRecEndDate(rule.endDate || '');
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  const handleSaveRecurrence = async () => {
    if (!recAmount || !recDescription.trim() || !recAccountId) {
      setErrorMsg('Completa el monto, la descripción y la cuenta.');
      return;
    }
    if (recType === 'expense' && !recCategoryId) {
      setErrorMsg('Selecciona una categoría para el gasto recurrente.');
      return;
    }
    if (!recEndDate) {
      setErrorMsg('Define la fecha de fin: todas las facturas de la recurrencia se crean de una sola vez entre el inicio y el fin.');
      return;
    }
    if (recEndDate < recStartDate) {
      setErrorMsg('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    setSavingRecurrence(true);
    setErrorMsg(null);
    try {
      const parsedAmount = parseFloat(recAmount.replace(/[^0-9]/g, '')) || 0;
      const parsedDay = parseInt(recDayOfMonth) || 5;
      const resolvedCategoryId = recType === 'income'
        ? (recCategoryId || incomeCategories[0]?.id || null)
        : recCategoryId;

      const payload = {
        accountId: recAccountId,
        categoryId: resolvedCategoryId,
        type: recType,
        amount: parsedAmount,
        description: recDescription.trim(),
        frequency: recFrequency,
        dayOfMonth: recFrequency === 'monthly' ? parsedDay : null,
        startDate: recStartDate,
        endDate: recEndDate,
      };

      const generator = new GenerateRecurringInstances(transactionRepo);

      if (editingRule) {
        const updatedRule = await recurrenceRepo.update(editingRule.id, payload);
        const oldEndDate = editingRule.endDate;
        // Editar la regla NUNCA toca las facturas ya creadas (monto, fecha o día se pueden
        // mover libremente sin que el sistema las regenere). Solo si se EXTIENDE la fecha de
        // fin (o se le agrega una por primera vez a una regla antigua sin fecha de fin) se
        // generan las facturas nuevas que faltan; si se ACORTA, se borran las pendientes que
        // quedaron después de la nueva fecha de fin. execute() es idempotente: nunca duplica
        // una fecha que ya tenga factura creada.
        if (!oldEndDate || recEndDate > oldEndDate) {
          await generator.execute(updatedRule, updatedRule.startDate, recEndDate);
        } else if (recEndDate < oldEndDate) {
          const pendingInstances = await transactionRepo.getAll({
            recurringRuleId: editingRule.id,
            status: 'pending',
          });
          const toRemove = pendingInstances.filter(tx => tx.transactionDate > recEndDate);
          await Promise.all(toRemove.map(tx => transactionRepo.delete(tx.id)));
        }
      } else {
        const createdRule = await recurrenceRepo.create(payload);
        await generator.execute(createdRule, createdRule.startDate, createdRule.endDate!);
      }

      setIsDialogVisible(false);
      resetDialogFields();
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la recurrencia.');
    } finally {
      setSavingRecurrence(false);
    }
  };

  const handleDeleteRecurrence = async (id: string) => {
    try {
      await recurrenceRepo.delete(id);
      loadData();
    } catch (err) {
      console.error('Error al eliminar recurrencia:', err);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Diario';
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      case 'yearly': return 'Anual';
      default: return freq;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }} statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Ingresos y Gastos Recurrentes" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
        <Button
          mode="contained"
          icon="plus"
          onPress={openCreateDialog}
          style={styles.addBtn}
        >
          Nueva Recurrencia
        </Button>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <Card style={styles.card}>
            <Card.Title title="Recurrencias Activas" />
            <Card.Content>
              {recurringRules.length === 0 ? (
                <Text style={{ textAlign: 'center', opacity: 0.6, paddingVertical: 24 }}>
                  No tienes ingresos ni gastos recurrentes programados.
                </Text>
              ) : (
                recurringRules.map(rule => (
                  <List.Item
                    key={rule.id}
                    title={rule.description}
                    description={
                      `${rule.type === 'income' ? 'Ingreso' : 'Gasto'} • $${rule.amount.toLocaleString('es-CO')} • ${getFrequencyLabel(rule.frequency)}` +
                      (rule.dayOfMonth ? ` • Día: ${rule.dayOfMonth}` : '') +
                      (rule.endDate ? ` • Hasta: ${rule.endDate}` : '')
                    }
                    left={props => (
                      <List.Icon
                        {...props}
                        icon={rule.type === 'income' ? 'cash-plus' : 'clock-outline'}
                        color={rule.type === 'income' ? theme.customColors.success : theme.colors.primary}
                      />
                    )}
                    onPress={() => openEditDialog(rule)}
                    right={() => (
                      <IconButton
                        icon="delete"
                        iconColor={theme.colors.error}
                        size={18}
                        onPress={() => handleDeleteRecurrence(rule.id)}
                      />
                    )}
                  />
                ))
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* ─── MODAL IMPECCABLE: RECURRENCIAS ─────────────────── */}
      <CreateRecurrenceModal
        visible={isDialogVisible}
        onClose={() => {
          setIsDialogVisible(false);
          setEditingRule(null);
        }}
        onSave={async (data) => {
          const payload = {
            accountId: data.accountId,
            categoryId: data.categoryId || null,
            type: data.type,
            amount: data.amount,
            description: data.description,
            frequency: data.frequency,
            dayOfMonth: data.frequency === 'monthly' ? (data.dayOfMonth || 5) : null,
            startDate: data.startDate,
            endDate: data.endDate || data.startDate,
          };

          const generator = new GenerateRecurringInstances(transactionRepo);

          if (editingRule) {
            const updatedRule = await recurrenceRepo.update(editingRule.id, payload);
            const oldEndDate = editingRule.endDate;
            if (!oldEndDate || (data.endDate && data.endDate > oldEndDate)) {
              await generator.execute(updatedRule, updatedRule.startDate, data.endDate || updatedRule.startDate);
            } else if (data.endDate && data.endDate < oldEndDate) {
              const pendingInstances = await transactionRepo.getAll({
                recurringRuleId: editingRule.id,
                status: 'pending',
              });
              const toRemove = pendingInstances.filter(tx => tx.transactionDate > data.endDate!);
              await Promise.all(toRemove.map(tx => transactionRepo.delete(tx.id)));
            }
          } else {
            const createdRule = await recurrenceRepo.create(payload);
            await generator.execute(createdRule, createdRule.startDate, createdRule.endDate || createdRule.startDate);
          }

          setEditingRule(null);
          loadData();
        }}
        editingRule={editingRule}
        accounts={accounts}
        categories={categories}
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
  dialogScrollArea: {
    paddingHorizontal: 0,
    maxHeight: 460,
  },
  dialogInput: {
    marginBottom: 12,
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },
  typeBtn: {
    marginRight: 6,
    marginBottom: 8,
    borderRadius: 8,
  },
  dateFieldWeb: {
    marginBottom: 12,
  },
  dateFieldWebRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateFieldLabel: {
    fontWeight: 'bold',
    marginBottom: 6,
    fontSize: 12,
  },
  dateFieldNative: {
    marginBottom: 0,
  },
});
