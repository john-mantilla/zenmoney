/**
 * ZenMoney — Modal para Crear/Editar Presupuesto y Límite Mensual (Impeccable.style)
 *
 * Presenta una interfaz responsive para web y móvil (tarjeta centrada en web),
 * selección de categoría, sugerencias inteligentes en tiempo real, selector
 * de ámbito (Familiar vs Personal) y fecha de inicio diferida.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Modal, Pressable, Platform, TouchableWithoutFeedback } from 'react-native';
import { Surface, Text, Button, TextInput, SegmentedButtons, RadioButton, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/presentation/theme';
import { Category } from '@/src/domain/entities/Category';
import { Budget } from '@/src/domain/entities/Budget';
import { CategoryPickerMenu } from './CategoryPickerMenu';
import { SmartBudgetSuggestionCard } from './SmartBudgetSuggestionCard';
import { SuggestRealisticBudget } from '@/src/domain/usecases/SuggestRealisticBudget';
import { Transaction } from '@/src/domain/entities/Transaction';

export interface CreateBudgetData {
  categoryId: string;
  amount: number;
  scope: 'family' | 'individual';
  startMode: 'current' | 'future';
  futureOffset: number;
}

interface CreateBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateBudgetData) => Promise<void>;
  onDelete?: () => Promise<void>;
  editingBudget?: Budget | null;
  categories: Category[];
  historicTransactions?: Transaction[];
  selectedYear: number;
  selectedMonth: number;
}

export const CreateBudgetModal: React.FC<CreateBudgetModalProps> = ({
  visible,
  onClose,
  onSave,
  onDelete,
  editingBudget,
  categories,
  historicTransactions = [],
  selectedYear,
  selectedMonth,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [selectedScope, setSelectedScope] = useState<'family' | 'individual'>('family');
  const [budgetStartMode, setBudgetStartMode] = useState<'current' | 'future'>('current');
  const [futureMonthOffset, setFutureMonthOffset] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingBudget) {
      setSelectedCategoryId(editingBudget.categoryId);
      setLimitAmount(String(editingBudget.amount));
      setSelectedScope(editingBudget.isFamilyGroupBudget === false ? 'individual' : 'family');
      setBudgetStartMode('current');
      setFutureMonthOffset(1);
    } else {
      setSelectedCategoryId(categories.length > 0 ? categories[0].id : '');
      setLimitAmount('');
      setSelectedScope('family');
      setBudgetStartMode('current');
      setFutureMonthOffset(1);
    }
    setErrorMsg(null);
  }, [editingBudget, visible, categories]);

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_) {}
  };

  const handleSave = async () => {
    if (!selectedCategoryId) {
      setErrorMsg('Selecciona una categoría para el presupuesto.');
      return;
    }

    const val = parseFloat(limitAmount.replace(/[^0-9.]/g, ''));
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a cero.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await onSave({
        categoryId: selectedCategoryId,
        amount: val,
        scope: selectedScope,
        startMode: budgetStartMode,
        futureOffset: futureMonthOffset,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el presupuesto.');
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : 'Categoría';
  };

  // Sugerencia inteligente en tiempo real
  const numVal = parseFloat(limitAmount) || 0;
  const realTimeSug =
    selectedCategoryId && numVal > 0
      ? SuggestRealisticBudget.execute(
          selectedCategoryId,
          numVal,
          historicTransactions,
          categories,
          selectedYear,
          selectedMonth
        )
      : null;

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
                  <View style={[styles.headerIconBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                    <MaterialCommunityIcons name="target" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                      {editingBudget ? 'Editar Presupuesto' : 'Nuevo Límite Mensual'}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      Establece metas de gasto por categoría
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

                {/* Categoría */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  CATEGORÍA
                </Text>
                {!editingBudget ? (
                  <CategoryPickerMenu
                    categories={categories.filter((c) => !c.isPrivate)}
                    selectedCategoryId={selectedCategoryId}
                    onSelect={(id) => {
                      triggerHaptic();
                      setSelectedCategoryId(id);
                    }}
                    style={{ marginBottom: 14 }}
                  />
                ) : (
                  <Surface style={[styles.categoryReadonly, { backgroundColor: theme.colors.surfaceVariant + '50' }]}>
                    <MaterialCommunityIcons name="tag-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[theme.typography.h4, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                      {getCategoryName(editingBudget.categoryId)}
                    </Text>
                  </Surface>
                )}

                {/* Monto Límite Mensual */}
                <TextInput
                  label="Monto Límite Mensual ($ COP)"
                  value={limitAmount}
                  onChangeText={(txt) => {
                    setLimitAmount(txt.replace(/[^0-9.]/g, ''));
                    setErrorMsg(null);
                  }}
                  mode="outlined"
                  keyboardType="numeric"
                  placeholder="500000"
                  style={styles.input}
                  disabled={isSaving}
                />

                {/* Sugerencia Inteligente */}
                {realTimeSug && (
                  <View style={{ marginBottom: 14 }}>
                    <SmartBudgetSuggestionCard
                      suggestion={realTimeSug}
                      onApplySuggestion={(newVal) => setLimitAmount(String(newVal))}
                    />
                  </View>
                )}

                {/* Ámbito / Visibilidad */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  VISIBILIDAD Y ÁMBITO
                </Text>
                <SegmentedButtons
                  value={selectedScope}
                  onValueChange={(val: string) => {
                    triggerHaptic();
                    setSelectedScope(val as 'family' | 'individual');
                  }}
                  buttons={[
                    {
                      value: 'family',
                      label: 'Familiar',
                      icon: 'account-group-outline',
                      checkedColor: theme.colors.primary,
                      uncheckedColor: theme.colors.onSurface,
                    },
                    {
                      value: 'individual',
                      label: 'Personal (Privado)',
                      icon: 'lock-outline',
                      checkedColor: theme.colors.primary,
                      uncheckedColor: theme.colors.onSurface,
                    },
                  ]}
                  density="small"
                  style={{ marginBottom: 16 }}
                />

                {/* Fecha de Inicio */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  INICIA A PARTIR DE
                </Text>
                <RadioButton.Group
                  onValueChange={(val) => {
                    triggerHaptic();
                    setBudgetStartMode(val as 'current' | 'future');
                  }}
                  value={budgetStartMode}
                >
                  <View style={styles.radioRow}>
                    <RadioButton value="current" color={theme.colors.primary} />
                    <Text style={[theme.typography.body, { color: theme.colors.onSurface }]}>
                      Este mes ({selectedYear}-{String(selectedMonth).padStart(2, '0')})
                    </Text>
                  </View>
                  <View style={[styles.radioRow, { marginTop: 4 }]}>
                    <RadioButton value="future" color={theme.colors.primary} />
                    <Text style={[theme.typography.body, { color: theme.colors.onSurface }]}>Mes futuro:</Text>
                  </View>
                </RadioButton.Group>

                {budgetStartMode === 'future' && (
                  <View style={styles.futurePickerRow}>
                    <IconButton
                      icon="minus"
                      size={18}
                      onPress={() => setFutureMonthOffset(Math.max(1, futureMonthOffset - 1))}
                    />
                    <Text style={{ fontWeight: '700', fontSize: 13, color: theme.colors.onSurface }}>
                      +{futureMonthOffset} mes{futureMonthOffset > 1 ? 'es' : ''}{' '}
                      {(() => {
                        let m = selectedMonth + futureMonthOffset;
                        let y = selectedYear;
                        while (m > 12) {
                          m -= 12;
                          y++;
                        }
                        return ` (${y}-${String(m).padStart(2, '0')})`;
                      })()}
                    </Text>
                    <IconButton
                      icon="plus"
                      size={18}
                      onPress={() => setFutureMonthOffset(Math.min(24, futureMonthOffset + 1))}
                    />
                  </View>
                )}

                {/* Botones de Acción */}
                <View style={styles.actionsRow}>
                  {editingBudget && onDelete && (
                    <Button
                      mode="outlined"
                      onPress={onDelete}
                      textColor={theme.colors.error}
                      style={{ borderColor: theme.colors.error + '40', borderRadius: 12 }}
                    >
                      Eliminar
                    </Button>
                  )}
                  <Button
                    mode="contained"
                    onPress={handleSave}
                    loading={isSaving}
                    disabled={isSaving || !limitAmount.trim()}
                    style={[styles.saveBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                    contentStyle={{ paddingVertical: 4 }}
                  >
                    Guardar
                  </Button>
                </View>
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
  categoryReadonly: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  futurePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 32,
    gap: 4,
  },
  errorBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  saveBtn: {
    borderRadius: 14,
  },
});
