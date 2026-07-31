/**
 * ZenMoney — Modal para Crear/Editar Categorías y Subcategorías (Impeccable.style)
 *
 * Ofrece una interfaz responsive para web y móvil (tarjeta centrada en web),
 * nombre de categoría, selector de Pilar 50/30/20 (Necesidad, Deseo, Ahorro, Ingreso)
 * e indicador de categoría padre.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Modal, Pressable, Platform, TouchableWithoutFeedback } from 'react-native';
import { Surface, Text, Button, TextInput, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/presentation/theme';
import { Category, BudgetRole } from '@/src/domain/entities/Category';

export interface CreateCategoryData {
  name: string;
  budgetRole: BudgetRole;
}

interface CreateCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateCategoryData) => Promise<void>;
  editingCategory?: Category | null;
  parentCategory?: Category | null;
}

const BUDGET_ROLES: { role: BudgetRole; label: string; icon: string; color: string }[] = [
  { role: 'needs', label: 'Necesidad (50%)', icon: 'home-city-outline', color: '#EF4444' },
  { role: 'wants', label: 'Deseo / Ocio (30%)', icon: 'palette-outline', color: '#F59E0B' },
  { role: 'savings', label: 'Ahorro / Inversión (20%)', icon: 'piggy-bank-outline', color: '#3B82F6' },
  { role: 'income', label: 'Ingreso Moneda', icon: 'cash-plus', color: '#10B981' },
];

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  visible,
  onClose,
  onSave,
  editingCategory,
  parentCategory,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [categoryName, setCategoryName] = useState('');
  const [budgetRole, setBudgetRole] = useState<BudgetRole>('wants');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingCategory) {
      setCategoryName(editingCategory.name);
      setBudgetRole(editingCategory.budgetRole || 'wants');
    } else {
      setCategoryName('');
      setBudgetRole('wants');
    }
    setErrorMsg(null);
  }, [editingCategory, visible]);

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_) {}
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      setErrorMsg('Ingresa un nombre para la categoría.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await onSave({
        name: categoryName.trim(),
        budgetRole,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la categoría.');
    } finally {
      setIsSaving(false);
    }
  };

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
                    <MaterialCommunityIcons name="shape-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                      {editingCategory
                        ? 'Editar Categoría'
                        : parentCategory
                        ? 'Nueva Subcategoría'
                        : 'Nueva Categoría Principal'}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      {parentCategory ? `Subcategoría de ${parentCategory.name}` : 'Clasificación de movimientos'}
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

                {/* Nombre de la Categoría */}
                <TextInput
                  label="Nombre (ej: Restaurantes, Mercado, Mascotas)"
                  value={categoryName}
                  onChangeText={setCategoryName}
                  mode="outlined"
                  style={styles.input}
                  disabled={isSaving}
                />

                {/* Selector de Pilar 50/30/20 */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  PILAR PRESUPUESTAL (SALUD FINANCIERA)
                </Text>
                <View style={styles.rolesGrid}>
                  {BUDGET_ROLES.map((r) => {
                    const isSelected = budgetRole === r.role;
                    return (
                      <Pressable
                        key={r.role}
                        onPress={() => {
                          triggerHaptic();
                          setBudgetRole(r.role);
                        }}
                        style={[
                          styles.roleCard,
                          {
                            borderColor: isSelected ? r.color : theme.colors.outline + '25',
                            backgroundColor: isSelected ? r.color + '15' : theme.colors.surface,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={r.icon as any}
                          size={20}
                          color={isSelected ? r.color : theme.customColors.textSecondary}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            color: isSelected ? r.color : theme.colors.onSurface,
                            fontWeight: isSelected ? '700' : '500',
                          }}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {parentCategory && !editingCategory && (
                  <Surface style={[styles.parentBadge, { backgroundColor: theme.colors.surfaceVariant + '60' }]}>
                    <MaterialCommunityIcons name="folder-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[theme.typography.caption, { color: theme.colors.onSurface }]}>
                      Se creará como subcategoría dentro de <Text style={{ fontWeight: '700' }}>{parentCategory.name}</Text>
                    </Text>
                  </Surface>
                )}

                {/* Botón de Guardar */}
                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={isSaving}
                  disabled={isSaving || !categoryName.trim()}
                  style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  Guardar
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
    marginBottom: 16,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  roleCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  parentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
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
