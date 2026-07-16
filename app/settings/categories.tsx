/**
 * ZenMoney — Gestión de Categorías y Subcategorías (Modular)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Text, ActivityIndicator, Dialog, Portal, TextInput, List, IconButton, Appbar } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import { SupabaseCategoryRepository } from '@/src/data/repositories/SupabaseCategoryRepository';
import { Category } from '@/src/domain/entities/Category';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function SettingsCategoriesScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  // Estados de datos
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de diálogo
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
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
        });
      } else {
        await categoryRepo.create({
          name: newCategoryName.trim(),
          icon: parentCategoryIdForNew ? 'tag' : 'folder-outline',
          color: theme.colors.primary,
          parentCategoryId: parentCategoryIdForNew || undefined,
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

  const parentCategories = categories.filter(c => !c.parentCategoryId);
  
  const getSubcategories = (parentId: string) => {
    return categories.filter(c => c.parentCategoryId === parentId);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Gestionar Categorías" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => { setParentCategoryIdForNew(''); setEditingCategory(null); setNewCategoryName(''); setIsDialogVisible(true); }}
          style={styles.addBtn}
        >
          Nueva Categoría
        </Button>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <Card style={styles.card}>
            <Card.Content>
              {parentCategories.length === 0 ? (
                <Text style={{ textAlign: 'center', opacity: 0.6, paddingVertical: 24 }}>
                  No tienes categorías configuradas.
                </Text>
              ) : (
                parentCategories.map(parentCat => {
                  const subs = getSubcategories(parentCat.id);
                  return (
                    <List.Accordion
                      key={parentCat.id}
                      title={parentCat.name}
                      description={`${subs.length} subcategorías`}
                      left={props => (
                        <List.Icon
                          {...props}
                          icon={parentCat.icon || 'tag'}
                          color={theme.colors.primary}
                        />
                      )}
                      right={({ isExpanded }) => (
                        <View style={styles.accordionRightRow}>
                          {!parentCat.isSystem && (
                            <>
                              <IconButton
                                icon="pencil-outline"
                                iconColor={theme.colors.primary}
                                size={18}
                                onPress={() => handleOpenEditDialog(parentCat)}
                              />
                              <IconButton
                                icon="trash-can-outline"
                                iconColor={theme.colors.error}
                                size={18}
                                onPress={() => handleDeleteCategory(parentCat.id)}
                              />
                            </>
                          )}
                          <MaterialCommunityIcons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={theme.customColors.textSecondary}
                          />
                        </View>
                      )}
                      style={styles.accordionHeader}
                    >
                      <List.Item
                        title="Añadir Subcategoría..."
                        titleStyle={{ color: theme.colors.primary, fontStyle: 'italic' }}
                        left={props => <List.Icon {...props} icon="plus" color={theme.colors.primary} />}
                        onPress={() => {
                          setParentCategoryIdForNew(parentCat.id);
                          setEditingCategory(null);
                          setNewCategoryName('');
                          setIsDialogVisible(true);
                        }}
                        style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                      />
                      {subs.map(subCat => (
                        <List.Item
                          key={subCat.id}
                          title={subCat.name}
                          right={() => (!subCat.isSystem ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <IconButton
                                icon="pencil-outline"
                                iconColor={theme.colors.primary}
                                size={18}
                                onPress={() => handleOpenEditDialog(subCat)}
                              />
                              <IconButton
                                icon="close-circle-outline"
                                iconColor={theme.colors.error}
                                size={18}
                                onPress={() => handleDeleteCategory(subCat.id)}
                              />
                            </View>
                          ) : null)}
                          style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                        />
                      ))}
                    </List.Accordion>
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
              ? 'Editar Nombre' 
              : (parentCategoryIdForNew ? 'Nueva Subcategoría' : 'Nueva Categoría Principal')}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nombre de la categoría (ej: Entretenimiento)"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              mode="outlined"
              style={styles.dialogInput}
              disabled={savingCategory}
            />
            {parentCategoryIdForNew && !editingCategory && (
              <Text style={{ fontStyle: 'italic', opacity: 0.7, fontSize: 12 }}>
                Se creará dentro de: {categories.find(c => c.id === parentCategoryIdForNew)?.name}
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
  accordionHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  accordionRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionItem: {
    paddingLeft: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.02)',
  },
  dialogInput: {
    marginBottom: 12,
  },
});
