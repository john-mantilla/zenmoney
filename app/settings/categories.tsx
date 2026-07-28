/**
 * ZenMoney — Gestión de Categorías y Subcategorías (Modular & Adaptativo)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Button, Card, Text, ActivityIndicator, Dialog, Portal, TextInput, Appbar } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import { SupabaseCategoryRepository } from '@/src/data/repositories/SupabaseCategoryRepository';
import { Category, inferCategoryBudgetRole } from '@/src/domain/entities/Category';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsCategoriesScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Estados de datos
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Acordeones abiertos
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  // Estados de diálogo
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newBudgetRole, setNewBudgetRole] = useState<'needs' | 'wants' | 'savings' | 'charity' | 'income' | 'ignore'>('needs');
  const [parentCategoryIdForNew, setParentCategoryIdForNew] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const categoryRepo = new SupabaseCategoryRepository();

  const loadData = async () => {
    setLoading(true);
    try {
      const loadedCats = await categoryRepo.getAll(true);
      setCategories(loadedCats);
    } catch (err) {
      console.error('[Categories Settings Screen Load Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleOpenEditDialog = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    const inferred = inferCategoryBudgetRole(category.name, undefined, category.budgetRole);
    setNewBudgetRole(inferred);
    setParentCategoryIdForNew(category.parentCategoryId || '');
    setIsDialogVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      if (editingCategory) {
        await categoryRepo.update(editingCategory.id, {
          name: newCategoryName.trim(),
          budgetRole: newBudgetRole,
        });
      } else {
        await categoryRepo.create({
          name: newCategoryName.trim(),
          icon: parentCategoryIdForNew ? 'tag' : 'folder-outline',
          color: theme.colors.primary,
          parentCategoryId: parentCategoryIdForNew || undefined,
          budgetRole: newBudgetRole,
          isPrivate: false,
        });
      }
      setIsDialogVisible(false);
      setNewCategoryName('');
      setEditingCategory(null);
      loadData();
    } catch (err) {
      console.error('Error al guardar categoría:', err);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await categoryRepo.delete(id);
      loadData();
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
    }
  };

  const toggleAccordion = (id: string) => {
    setExpandedCats((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const parentCategories = categories.filter((c) => !c.parentCategoryId);

  const getSubcategories = (parentId: string) => {
    return categories.filter((c) => c.parentCategoryId === parentId);
  };

  const getRoleLabel = (role?: string, name?: string, parentName?: string) => {
    const effectiveRole = name ? inferCategoryBudgetRole(name, parentName, role as any) : role || 'needs';
    switch (effectiveRole) {
      case 'wants':
        return { label: '🟡 Deseo', color: '#D97706', bg: '#D9770615' };
      case 'savings':
        return { label: '🔵 Ahorro', color: '#2563EB', bg: '#2563EB15' };
      case 'charity':
        return { label: '🟢 Caridad', color: '#059669', bg: '#05966915' };
      case 'income':
        return { label: '🟢 Ingreso', color: '#10B981', bg: '#10B98115' };
      case 'ignore':
        return { label: '⚪ Ignorar', color: '#6B7280', bg: '#6B728015' };
      case 'needs':
      default:
        return { label: '🔴 Necesidad', color: '#E11D48', bg: '#E11D4815' };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }} statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Gestionar Categorías" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => {
            setParentCategoryIdForNew('');
            setEditingCategory(null);
            setNewCategoryName('');
            setNewBudgetRole('needs');
            setIsDialogVisible(true);
          }}
          style={styles.addBtn}
        >
          Nueva Categoría
        </Button>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <Card style={styles.card}>
            <Card.Content style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
              {parentCategories.length === 0 ? (
                <Text style={{ textAlign: 'center', opacity: 0.6, paddingVertical: 24 }}>
                  No tienes categorías configuradas.
                </Text>
              ) : (
                parentCategories.map((parentCat) => {
                  const subs = getSubcategories(parentCat.id);
                  const pBadge = getRoleLabel(parentCat.budgetRole, parentCat.name);
                  const isExpanded = !!expandedCats[parentCat.id];

                  return (
                    <View key={parentCat.id} style={styles.accordionContainer}>
                      {/* Cabecera de Categoría Principal */}
                      <View style={styles.accordionHeaderRow}>
                        <TouchableOpacity
                          style={styles.accordionTitleArea}
                          onPress={() => toggleAccordion(parentCat.id)}
                        >
                          <MaterialCommunityIcons
                            name={(parentCat.icon as any) || 'tag'}
                            size={22}
                            color={theme.colors.primary}
                            style={{ marginRight: 12 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', fontSize: 14, color: theme.colors.onSurface }}>
                              {parentCat.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.customColors.textSecondary, marginTop: 2 }}>
                              {subs.length} subcategorías
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Botones de Acción */}
                        <View style={styles.accordionRightRow}>
                          <TouchableOpacity
                            style={[styles.badgeChip, { backgroundColor: pBadge.bg }]}
                            onPress={() => handleOpenEditDialog(parentCat)}
                          >
                            <Text style={{ color: pBadge.color, fontSize: 11, fontWeight: '700' }}>
                              {pBadge.label}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{ padding: 6, marginRight: 2 }}
                            onPress={() => handleOpenEditDialog(parentCat)}
                          >
                            <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.colors.primary} />
                          </TouchableOpacity>

                          {!parentCat.isSystem && (
                            <TouchableOpacity
                              style={{ padding: 6, marginRight: 2 }}
                              onPress={() => handleDeleteCategory(parentCat.id)}
                            >
                              <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.colors.error} />
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity style={{ padding: 6 }} onPress={() => toggleAccordion(parentCat.id)}>
                            <MaterialCommunityIcons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color={theme.customColors.textSecondary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Lista de Subcategorías */}
                      {isExpanded && (
                        <View style={styles.subContainer}>
                          <TouchableOpacity
                            style={styles.addSubRow}
                            onPress={() => {
                              setParentCategoryIdForNew(parentCat.id);
                              setEditingCategory(null);
                              setNewCategoryName('');
                              setNewBudgetRole(parentCat.budgetRole || 'needs');
                              setIsDialogVisible(true);
                            }}
                          >
                            <MaterialCommunityIcons name="plus" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                            <Text style={{ color: theme.colors.primary, fontStyle: 'italic', fontSize: 13, fontWeight: '600' }}>
                              Añadir Subcategoría...
                            </Text>
                          </TouchableOpacity>

                          {subs.map((subCat) => {
                            const sBadge = getRoleLabel(subCat.budgetRole, subCat.name, parentCat.name);
                            return (
                              <View key={subCat.id} style={styles.subCatRow}>
                                <Text style={{ flex: 1, fontSize: 13, color: theme.colors.onSurface, fontWeight: '500' }}>
                                  {subCat.name}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <TouchableOpacity
                                    style={[styles.badgeChip, { backgroundColor: sBadge.bg, height: 24, paddingHorizontal: 8 }]}
                                    onPress={() => handleOpenEditDialog(subCat)}
                                  >
                                    <Text style={{ color: sBadge.color, fontSize: 10, fontWeight: '700' }}>
                                      {sBadge.label}
                                    </Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={{ padding: 6, marginRight: 2 }}
                                    onPress={() => handleOpenEditDialog(subCat)}
                                  >
                                    <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.colors.primary} />
                                  </TouchableOpacity>

                                  {!subCat.isSystem && (
                                    <TouchableOpacity
                                      style={{ padding: 6 }}
                                      onPress={() => handleDeleteCategory(subCat.id)}
                                    >
                                      <MaterialCommunityIcons name="close-circle-outline" size={18} color={theme.colors.error} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* ─── PORTAL DIÁLOGO: AGREGAR/EDITAR CATEGORÍA ─────────────────────────── */}
      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)}>
          <Dialog.Title>
            {editingCategory
              ? 'Editar Categoría'
              : parentCategoryIdForNew
              ? 'Nueva Subcategoría'
              : 'Nueva Categoría Principal'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nombre (ej: Restaurantes, Sushi)"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              mode="outlined"
              style={styles.dialogInput}
              disabled={savingCategory}
            />

            {/* Selector de Pilar 50/30/20 */}
            <Text style={{ fontWeight: '700', fontSize: 12, marginTop: 8, marginBottom: 6, color: theme.colors.onSurface }}>
              Pilar Presupuestal (Metodología Financial)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[
                { role: 'needs', label: '🔴 Necesidad' },
                { role: 'wants', label: '🟡 Deseo' },
                { role: 'savings', label: '🔵 Ahorro' },
                { role: 'income', label: '🟢 Ingreso' },
              ].map((item) => (
                <Button
                  key={item.role}
                  mode={newBudgetRole === item.role ? 'contained' : 'outlined'}
                  compact
                  onPress={() => setNewBudgetRole(item.role as any)}
                  style={{ borderRadius: 8, marginBottom: 4 }}
                  labelStyle={{ fontSize: 11 }}
                >
                  {item.label}
                </Button>
              ))}
            </View>

            {!!parentCategoryIdForNew && !editingCategory && (
              <Text style={{ fontStyle: 'italic', opacity: 0.7, fontSize: 12 }}>
                Se creará dentro de: {categories.find((c) => c.id === parentCategoryIdForNew)?.name}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setIsDialogVisible(false)}
              textColor={theme.customColors.textSecondary}
              disabled={savingCategory}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveCategory}
              loading={savingCategory}
              disabled={savingCategory || !newCategoryName.trim()}
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
    overflow: 'hidden',
  },
  accordionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  accordionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  accordionTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingLeft: 24,
    paddingRight: 16,
    paddingBottom: 8,
  },
  addSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  subCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  dialogInput: {
    marginBottom: 12,
  },
});
