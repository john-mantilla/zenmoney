/**
 * ZenMoney — CategorySplitSheet Component
 *
 * Modal interactivo para desglosar un gasto único en dos o más categorías
 * con validación matemática en tiempo real (suma exacta = monto total).
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { Surface, Text, TextInput, Button, IconButton, Portal, Dialog } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/src/presentation/theme';
import { Category } from '@/src/domain/entities/Category';
import { TransactionCategorySplit } from '@/src/domain/entities/Transaction';
import { CategoryBottomSheet } from './CategoryBottomSheet';

export interface CategorySplitSheetProps {
  visible: boolean;
  onDismiss: () => void;
  totalAmount: number;
  categories: Category[];
  initialSplits?: TransactionCategorySplit[];
  onConfirmSplits: (splits: TransactionCategorySplit[]) => void;
  initialCategoryId?: string | null;
}

export const CategorySplitSheet: React.FC<CategorySplitSheetProps> = ({
  visible,
  onDismiss,
  totalAmount,
  categories,
  initialSplits = [],
  onConfirmSplits,
  initialCategoryId = null,
}) => {
  const theme = useAppTheme();
  const [splits, setSplits] = useState<TransactionCategorySplit[]>([]);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);

  // Inicializar splits al abrir
  useEffect(() => {
    if (visible) {
      if (initialSplits && initialSplits.length >= 2) {
        setSplits(initialSplits.map(s => ({ ...s })));
      } else {
        const cat1 = initialCategoryId || (categories[0]?.id ?? '');
        const cat2 = categories.find(c => c.id !== cat1)?.id ?? '';
        const half1 = Math.round(totalAmount / 2);
        const half2 = totalAmount - half1;
        setSplits([
          { id: 'split-1', categoryId: cat1, amount: half1, note: '' },
          { id: 'split-2', categoryId: cat2, amount: half2, note: '' },
        ]);
      }
    }
  }, [visible, initialSplits, totalAmount, initialCategoryId, categories]);

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
    } catch (_) {}
  };

  const currentSum = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const diff = Math.round((totalAmount - currentSum) * 100) / 100;
  const isExactMatch = Math.abs(diff) < 0.01 && splits.length >= 2 && splits.every(s => s.amount > 0 && !!s.categoryId);

  const handleAddSplit = () => {
    triggerHaptic();
    const remainingToAssign = Math.max(0, diff);
    const existingCatIds = new Set(splits.map(s => s.categoryId));
    const nextCat = categories.find(c => !existingCatIds.has(c.id))?.id || categories[0]?.id || '';
    setSplits([
      ...splits,
      {
        id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        categoryId: nextCat,
        amount: remainingToAssign,
        note: '',
      },
    ]);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length <= 2) return;
    triggerHaptic();
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleUpdateAmount = (index: number, text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    const num = parseInt(clean, 10) || 0;
    const updated = [...splits];
    updated[index].amount = num;
    setSplits(updated);
  };

  const handleUpdateNote = (index: number, note: string) => {
    const updated = [...splits];
    updated[index].note = note;
    setSplits(updated);
  };

  const handleDistributeRemaining = (index: number) => {
    triggerHaptic();
    const otherSum = splits.reduce((acc, s, i) => (i === index ? acc : acc + (Number(s.amount) || 0)), 0);
    const updated = [...splits];
    updated[index].amount = Math.max(0, totalAmount - otherSum);
    setSplits(updated);
  };

  const handleCategorySelect = (categoryId: string) => {
    if (pickingIndex === null) return;
    triggerHaptic();
    const updated = [...splits];
    updated[pickingIndex].categoryId = categoryId;
    setSplits(updated);
    setPickingIndex(null);
  };

  const handleConfirm = () => {
    if (!isExactMatch) return;
    triggerHaptic();
    onConfirmSplits(splits);
    onDismiss();
  };

  const getCategoryName = (catId: string) => {
    const found = categories.find(c => c.id === catId);
    return found ? found.name : 'Seleccionar categoría';
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={styles.dialogTitle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="call-split" size={22} color={theme.colors.primary} />
            <Text style={[theme.typography.body, { fontWeight: '700', fontSize: 16 }]}>
              Desglose de Categorías
            </Text>
          </View>
        </Dialog.Title>

        <Dialog.Content style={styles.dialogContent}>
          {/* Tarjeta de Total */}
          <Surface style={[styles.totalCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                Monto Total de la Transacción:
              </Text>
              <Text style={[theme.typography.body, { fontWeight: '800', fontSize: 16, color: theme.colors.onSurface }]}>
                ${totalAmount.toLocaleString('es-CO')}
              </Text>
            </View>
          </Surface>

          {/* Lista de Splits */}
          <ScrollView style={styles.splitsList} showsVerticalScrollIndicator={false}>
            {splits.map((split, index) => {
              const catName = getCategoryName(split.categoryId);
              return (
                <Surface
                  key={split.id || index}
                  style={[
                    styles.splitItem,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.outline + '35',
                    },
                  ]}
                >
                  <View style={styles.splitRow}>
                    {/* Selector de Categoría */}
                    <Pressable
                      onPress={() => setPickingIndex(index)}
                      style={[
                        styles.categoryBtn,
                        {
                          backgroundColor: theme.colors.surfaceVariant,
                          borderColor: theme.colors.outline + '40',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="tag-outline"
                        size={16}
                        color={theme.colors.primary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        numberOfLines={1}
                        style={[theme.typography.caption, { fontWeight: '600', color: theme.colors.onSurface, flex: 1 }]}
                      >
                        {catName}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={16} color={theme.customColors.textSecondary} />
                    </Pressable>

                    {/* Input de Monto */}
                    <TextInput
                      value={split.amount ? String(split.amount) : ''}
                      onChangeText={(t) => handleUpdateAmount(index, t)}
                      placeholder="0"
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                      style={styles.amountInput}
                      left={<TextInput.Affix text="$" />}
                    />

                    {/* Botón Borrar (siempre que haya más de 2) */}
                    {splits.length > 2 && (
                      <IconButton
                        icon="trash-can-outline"
                        size={18}
                        iconColor={theme.colors.error}
                        onPress={() => handleRemoveSplit(index)}
                        style={styles.deleteBtn}
                      />
                    )}
                  </View>

                  <View style={styles.noteRow}>
                    <TextInput
                      value={split.note || ''}
                      onChangeText={(n) => handleUpdateNote(index, n)}
                      placeholder="Nota (opcional)"
                      mode="outlined"
                      dense
                      style={styles.noteInput}
                    />
                    {diff !== 0 && (
                      <Pressable
                        onPress={() => handleDistributeRemaining(index)}
                        style={[styles.autoFillBtn, { backgroundColor: theme.colors.primaryContainer }]}
                      >
                        <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', fontSize: 11 }]}>
                          Ajustar resto
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </Surface>
              );
            })}

            {/* Botón Añadir Categoría */}
            <Button
              mode="text"
              icon="plus"
              onPress={handleAddSplit}
              style={{ marginTop: 4, alignSelf: 'flex-start' }}
            >
              Agregar otra categoría
            </Button>
          </ScrollView>

          {/* Barra de Validación Matemática en Tiempo Real */}
          <Surface
            style={[
              styles.validationBar,
              {
                backgroundColor: isExactMatch
                  ? '#10B98118'
                  : diff > 0
                  ? '#F59E0B18'
                  : '#EF444418',
                borderColor: isExactMatch
                  ? '#10B98140'
                  : diff > 0
                  ? '#F59E0B40'
                  : '#EF444440',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons
                name={isExactMatch ? 'check-circle' : diff > 0 ? 'alert-circle-outline' : 'close-circle-outline'}
                size={18}
                color={isExactMatch ? '#059669' : diff > 0 ? '#D97706' : '#DC2626'}
              />
              <Text
                style={[
                  theme.typography.caption,
                  {
                    fontWeight: '700',
                    color: isExactMatch ? '#059669' : diff > 0 ? '#D97706' : '#DC2626',
                    flex: 1,
                  },
                ]}
              >
                {isExactMatch
                  ? 'Suma exacta cuadrada ✓'
                  : diff > 0
                  ? `Faltan $${diff.toLocaleString('es-CO')} por asignar`
                  : `Supera el total por $${Math.abs(diff).toLocaleString('es-CO')}`}
              </Text>
              <Text style={[theme.typography.caption, { fontWeight: '600', color: theme.colors.onSurface }]}>
                ${currentSum.toLocaleString('es-CO')} / ${totalAmount.toLocaleString('es-CO')}
              </Text>
            </View>
          </Surface>
        </Dialog.Content>

        <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Button onPress={onDismiss} textColor={theme.customColors.textSecondary}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={handleConfirm}
            disabled={!isExactMatch}
            style={{ borderRadius: 10 }}
          >
            Aplicar Desglose
          </Button>
        </Dialog.Actions>

        {/* Modal de selección de categoría para la fila activa */}
        <CategoryBottomSheet
          visible={pickingIndex !== null}
          onClose={() => setPickingIndex(null)}
          onSelect={handleCategorySelect}
          categories={categories}
          selectedCategoryId={pickingIndex !== null ? (splits[pickingIndex]?.categoryId || '') : ''}
        />
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 20,
    maxHeight: '90%',
  },
  dialogTitle: {
    paddingBottom: 4,
  },
  dialogContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  totalCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  splitsList: {
    maxHeight: 280,
  },
  splitItem: {
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  amountInput: {
    width: 120,
    height: 40,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    margin: 0,
    width: 32,
    height: 32,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  noteInput: {
    flex: 1,
    height: 36,
    fontSize: 12,
  },
  autoFillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  validationBar: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
