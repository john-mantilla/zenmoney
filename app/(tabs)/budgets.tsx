/**
 * ZenMoney — Gestión de Presupuestos Mensuales
 *
 * Muestra el progreso de consumo frente a los límites mensuales por categoría,
 * con alertas visuales de colores y soporte completo para agregar, editar y
 * eliminar presupuestos en tiempo real.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Text, FAB, Card, ProgressBar, Button, Dialog, Portal, TextInput, ActivityIndicator, IconButton, HelperText } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { EmptyState, AmountDisplay, CategoryPickerMenu, NetworkStatusBar } from '@/src/presentation/components';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { CalculateBudgetProgress } from '@/src/domain/usecases/CalculateBudgetProgress';
import { Budget, BudgetProgress } from '@/src/domain/entities/Budget';
import { Category } from '@/src/domain/entities/Category';
import { useFocusEffect } from 'expo-router';

interface BudgetTreeChild {
  id: string;
  categoryId: string;
  name: string;
  amountLimit: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  budget: Budget;
}

interface BudgetTreeItem {
  id: string;
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  hasDirectBudget: boolean;
  budget?: Budget;
  amountLimit: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  children: BudgetTreeChild[];
}

const CustomProgressBar = ({ progress, color }: { progress: number; color: string }) => {
  return (
    <View style={{ height: 6, width: '100%', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, marginVertical: 6, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.min(Math.max(progress * 100, 0), 100)}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
};

export default function BudgetsScreen() {
  const theme = useAppTheme();

  // Estados de datos
  const [budgetsProgress, setBudgetsProgress] = useState<BudgetTreeItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleExpand = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };
  
  // Estados de carga e interfaz
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para Modal/Diálogo (Crear / Editar)
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Repositorios
  const budgetRepo = new HybridBudgetRepository();
  const transactionRepo = new HybridTransactionRepository();
  const categoryRepo = new HybridCategoryRepository();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const loadData = async () => {
    try {
      // 1. Cargar todas las categorías
      const loadedCats = await categoryRepo.getAll(true);
      setCategories(loadedCats);
      if (loadedCats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(loadedCats[0].id);
      }

      // 2. Cargar presupuestos del mes actual
      const monthlyBudgets = await budgetRepo.getByMonth(currentYear, currentMonth);

      // 3. Cargar todos los egresos del mes actual en una única consulta para optimizar rendimiento
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const monthlyExpenses = await transactionRepo.getAll({
        startDate,
        endDate,
        type: 'expense',
        status: 'confirmed'
      });

      const getDirectSpent = (catId: string) => {
        return monthlyExpenses
          .filter(tx => tx.categoryId === catId)
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
      };

      const getCategoryAndSubcategoriesSpent = (catId: string) => {
        const subCatIds = loadedCats.filter(c => c.parentCategoryId === catId).map(c => c.id);
        const targetIds = [catId, ...subCatIds];
        return monthlyExpenses
          .filter(tx => tx.categoryId && targetIds.includes(tx.categoryId))
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
      };

      // 4. Clasificar cada presupuesto y construir agrupaciones por categoría padre
      const rawProgress = monthlyBudgets.map(budget => {
        const cat = loadedCats.find(c => c.id === budget.categoryId);
        const isSubcategory = !!cat?.parentCategoryId;
        const parentId = isSubcategory ? cat!.parentCategoryId! : budget.categoryId;
        const spent = getDirectSpent(budget.categoryId);
        
        return {
          budget,
          categoryId: budget.categoryId,
          parentId,
          isSubcategory,
          spent,
        };
      });

      const parentGroups: Record<string, {
        parentBudget?: typeof rawProgress[0];
        subBudgets: typeof rawProgress[0][];
      }> = {};

      for (const p of rawProgress) {
        if (!parentGroups[p.parentId]) {
          parentGroups[p.parentId] = { subBudgets: [] };
        }
        if (p.isSubcategory) {
          parentGroups[p.parentId].subBudgets.push(p);
        } else {
          parentGroups[p.parentId].parentBudget = p;
        }
      }

      // 5. Construir los elementos árbol finales
      const treeItems: BudgetTreeItem[] = Object.entries(parentGroups).map(([parentId, group]) => {
        const parentCat = loadedCats.find(c => c.id === parentId);
        const name = parentCat ? parentCat.name : 'Desconocido';
        const icon = parentCat ? parentCat.icon : 'tag';
        const color = parentCat ? parentCat.color : '#9E9E9E';

        let amountLimit = 0;
        let spent = 0;
        let hasDirectBudget = false;
        let budgetId = '';

        if (group.subBudgets.length > 0) {
          // Límite consolidado de subcategorías
          amountLimit = group.subBudgets.reduce((sum, s) => sum + s.budget.amountLimit, 0);
          
          // Gasto consolidado: gasto directo del padre + gasto de sus subcategorías
          const parentDirectSpent = group.parentBudget ? group.parentBudget.spent : getDirectSpent(parentId);
          spent = group.subBudgets.reduce((sum, s) => sum + s.spent, 0) + parentDirectSpent;
          
          hasDirectBudget = !!group.parentBudget;
          budgetId = group.parentBudget?.budget.id || `virtual-${parentId}`;
        } else {
          // Solo se definió presupuesto en la categoría padre
          const p = group.parentBudget!;
          amountLimit = p.budget.amountLimit;
          spent = getCategoryAndSubcategoriesSpent(parentId);
          hasDirectBudget = true;
          budgetId = p.budget.id;
        }

        const remaining = amountLimit - spent;
        const percentage = amountLimit > 0 ? Math.round((spent / amountLimit) * 100) : 0;
        
        let status: 'ok' | 'warning' | 'exceeded' = 'ok';
        if (percentage >= 100) {
          status = 'exceeded';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        const children: BudgetTreeChild[] = group.subBudgets.map(s => {
          const subCat = loadedCats.find(c => c.id === s.categoryId);
          const subSpent = s.spent;
          const subLimit = s.budget.amountLimit;
          const subRemaining = subLimit - subSpent;
          const subPercentage = subLimit > 0 ? Math.round((subSpent / subLimit) * 100) : 0;
          
          let subStatus: 'ok' | 'warning' | 'exceeded' = 'ok';
          if (subPercentage >= 100) {
            subStatus = 'exceeded';
          } else if (subPercentage >= 80) {
            subStatus = 'warning';
          }

          return {
            id: s.budget.id,
            categoryId: s.categoryId,
            name: subCat ? subCat.name : 'Subcategoría',
            amountLimit: subLimit,
            spent: subSpent,
            remaining: subRemaining,
            percentage: subPercentage,
            status: subStatus,
            budget: s.budget,
          };
        }).sort((a, b) => b.percentage - a.percentage);

        return {
          id: budgetId,
          categoryId: parentId,
          name,
          icon,
          color,
          hasDirectBudget,
          budget: group.parentBudget?.budget,
          amountLimit,
          spent,
          remaining,
          percentage,
          status,
          children,
        };
      });

      // Ordenar por consumo consolidado (de mayor a menor)
      setBudgetsProgress(treeItems.sort((a, b) => b.percentage - a.percentage));
    } catch (err) {
      console.error('[Budgets Load Error]:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ─── CRUD Presupuestos ────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingBudget(null);
    setLimitAmount('');
    if (categories.length > 0) setSelectedCategoryId(categories[0].id);
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  const openEditDialog = (budget: Budget) => {
    setEditingBudget(budget);
    setLimitAmount(String(budget.amountLimit));
    setSelectedCategoryId(budget.categoryId);
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  const handleSaveBudget = async () => {
    if (!limitAmount || parseFloat(limitAmount) <= 0) {
      setErrorMsg('Por favor ingresa un límite de dinero válido mayor a cero.');
      return;
    }

    setIsLoading(true);
    try {
      const limitNum = parseFloat(limitAmount);

      if (editingBudget) {
        // Actualizar
        await budgetRepo.update(editingBudget.id, {
          amountLimit: limitNum,
        });
      } else {
        // Verificar si la categoría ya tiene presupuesto este mes (directo o subcategoría)
        const exists = budgetsProgress.some(
          b => b.categoryId === selectedCategoryId || b.children.some(c => c.categoryId === selectedCategoryId)
        );
        if (exists) {
          setErrorMsg('Ya configuraste un presupuesto para esta categoría este mes. Edita el existente.');
          setIsLoading(false);
          return;
        }

        // Crear
        await budgetRepo.create({
          categoryId: selectedCategoryId,
          amountLimit: limitNum,
          year: currentYear,
          month: currentMonth,
        });
      }

      setIsDialogVisible(false);
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el presupuesto.');
      setIsLoading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    setIsLoading(true);
    try {
      await budgetRepo.delete(id);
      setIsDialogVisible(false);
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar el presupuesto.');
      setIsLoading(false);
    }
  };

  // Helper para datos visuales de categorías
  const getCategoryDetails = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? { name: cat.name, icon: cat.icon, color: cat.color } : { name: 'Desconocido', icon: 'tag', color: '#9E9E9E' };
  };

  // Cálculos consolidados globales (Visualización HomeBudget style)
  const totalBudgeted = budgetsProgress.reduce((sum, bp) => sum + bp.amountLimit, 0);
  const totalSpent = budgetsProgress.reduce((sum, bp) => sum + bp.spent, 0);
  const availableBudget = totalBudgeted - totalSpent;
  const globalPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  // Determinar color de barra global
  let globalColor = theme.colors.primary;
  if (globalPercentage >= 100) {
    globalColor = theme.customColors.danger;
  } else if (globalPercentage >= 80) {
    globalColor = theme.customColors.accent;
  }

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NetworkStatusBar />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        {/* ─── TARJETA CONSOLIDADA (HomeBudget style) ───────────────────────── */}
        {totalBudgeted > 0 && (
          <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <Card.Content>
              <Text style={[styles.summaryLabel, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                Disponible del Presupuesto
              </Text>
              
              <AmountDisplay
                amount={availableBudget}
                size="lg"
                type={availableBudget < 0 ? 'expense' : 'income'}
                style={styles.summaryAmount}
              />

              <View style={styles.summaryBarRow}>
                <Text style={theme.typography.bodySmall}>
                  Consumido: {Math.round(globalPercentage)}%
                </Text>
                 <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary }]}>
                  Límite: <AmountDisplay amount={totalBudgeted} size="sm" style={{ color: theme.colors.onSurface }} />
                </Text>
              </View>

              <ProgressBar
                progress={Math.min(globalPercentage / 100, 1)}
                color={globalColor}
                style={styles.progressBar}
              />
            </Card.Content>
          </Card>
        )}

        {/* ─── LISTADO DE LÍMITES POR CATEGORÍA ─────────────────────────────────── */}
        <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
          Presupuesto por Categorías
        </Text>

        {budgetsProgress.length === 0 ? (
          <EmptyState
            icon="chart-arc"
            title="Sin presupuestos"
            description="Configura límites mensuales para llevar un control estricto de tus gastos."
            actionLabel="Configurar Primer Límite"
            onAction={openCreateDialog}
          />
        ) : (
          <View style={styles.budgetsList}>
            {budgetsProgress.map(bp => {
              const isExpanded = expandedCategories[bp.categoryId] || false;
              
              // Determinar color de barra individual del padre
              let barColor = theme.colors.primary;
              if (bp.status === 'exceeded') {
                barColor = theme.customColors.danger;
              } else if (bp.status === 'warning') {
                barColor = theme.customColors.accent;
              }

              return (
                <View
                  key={bp.id}
                  style={[styles.budgetItemCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                >
                  {/* Encabezado del presupuesto Padre (Clickable para expandir/colapsar) */}
                  <Pressable
                    onPress={bp.children.length > 0 ? () => toggleExpand(bp.categoryId) : (bp.hasDirectBudget && bp.budget ? () => openEditDialog(bp.budget!) : undefined)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
                  >
                    <View style={styles.categoryInfo}>
                      <IconButton
                        icon={bp.icon || 'tag'}
                        iconColor={bp.color}
                        size={20}
                        style={{ margin: 0, marginRight: 4 }}
                      />
                      <Text style={[styles.categoryName, theme.typography.h4]}>
                        {bp.name}
                      </Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.amountsInfo}>
                        <AmountDisplay amount={bp.spent} size="sm" type="expense" />
                        <Text style={[styles.limitLabel, theme.typography.caption]}>
                          de <AmountDisplay amount={bp.amountLimit} size="sm" style={{ color: theme.customColors.textSecondary }} />
                        </Text>
                      </View>
                      {bp.hasDirectBudget && bp.budget && (
                        <IconButton
                          icon="pencil-outline"
                          size={18}
                          style={{ margin: 0, marginLeft: 4, padding: 0 }}
                          onPress={() => openEditDialog(bp.budget!)}
                        />
                      )}
                      {bp.children.length > 0 && (
                        <IconButton
                          icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          style={{ margin: 0, marginLeft: 4, padding: 0 }}
                          onPress={() => toggleExpand(bp.categoryId)}
                        />
                      )}
                    </View>
                  </Pressable>

                  {/* Barra de progreso consolidada del padre */}
                  <CustomProgressBar progress={bp.percentage / 100} color={barColor} />

                  {/* Footer con el consumo de la categoría padre */}
                  <View style={styles.budgetItemFooter}>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      {bp.percentage}% consumido
                    </Text>
                    <Text style={[theme.typography.caption, { color: bp.remaining < 0 ? theme.colors.error : theme.colors.primary }]}>
                      {bp.remaining < 0 
                        ? `Excedido por: $${Math.abs(bp.remaining).toLocaleString('es-CO')}` 
                        : `Restan: $${bp.remaining.toLocaleString('es-CO')}`}
                    </Text>
                  </View>

                  {/* Si tiene subcategorías con presupuesto y está expandido, renderizarlas */}
                  {isExpanded && bp.children.length > 0 && (
                    <View style={{ marginTop: 8, width: '100%' }}>
                      {bp.children.map(child => {
                        let childBarColor = theme.colors.primary;
                        if (child.status === 'exceeded') {
                          childBarColor = theme.customColors.danger;
                        } else if (child.status === 'warning') {
                          childBarColor = theme.customColors.accent;
                        }

                        return (
                          <View key={child.id} style={[styles.childContainer, { borderLeftColor: theme.customColors.border }]}>
                            <View style={styles.childHeader}>
                              <Text style={[styles.childName, theme.typography.body, { color: theme.customColors.text }]}>
                                {child.name}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.childAmountsInfo}>
                                  <AmountDisplay amount={child.spent} size="sm" type="expense" />
                                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                                    {' '}de <AmountDisplay amount={child.amountLimit} size="sm" style={{ color: theme.customColors.textSecondary }} />
                                  </Text>
                                </View>
                                <IconButton
                                  icon="pencil-outline"
                                  size={16}
                                  iconColor={theme.customColors.textSecondary}
                                  style={{ margin: 0, marginLeft: 4, padding: 0 }}
                                  onPress={() => openEditDialog(child.budget)}
                                />
                              </View>
                            </View>

                            <CustomProgressBar progress={child.percentage / 100} color={childBarColor} />

                            <View style={styles.childFooter}>
                              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
                                {child.percentage}% consumido
                              </Text>
                              <Text style={[theme.typography.caption, { fontSize: 11, color: child.remaining < 0 ? theme.colors.error : theme.colors.primary }]}>
                                {child.remaining < 0 
                                  ? `Excedido por: $${Math.abs(child.remaining).toLocaleString('es-CO')}` 
                                  : `Restan: $${child.remaining.toLocaleString('es-CO')}`}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Botón flotante FAB para agregar presupuestos */}
      <FAB
        icon="plus"
        label="Nuevo Límite"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#FFFFFF"
        onPress={openCreateDialog}
      />

      {/* ─── PORTAL DIÁLOGO: CREAR / EDITAR PRESUPUESTO ──────────────────────── */}
      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)}>
          <Dialog.Title>{editingBudget ? 'Editar Presupuesto' : 'Nuevo Límite Mensual'}</Dialog.Title>
          <Dialog.Content>
            
            {errorMsg && (
              <HelperText type="error" visible={!!errorMsg}>
                {errorMsg}
              </HelperText>
            )}

            {/* Selector de categoría (solo disponible al crear) */}
            {!editingBudget && (
              <>
                <Text style={[styles.dialogLabel, theme.typography.caption]}>Categoría</Text>
                <CategoryPickerMenu
                  categories={categories.filter(c => !c.isPrivate)} // No presupuestamos categorías privadas en MVP
                  selectedCategoryId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  style={{ marginBottom: 12, alignSelf: 'flex-start' }}
                />
              </>
            )}

            {editingBudget && (
              <Text style={[theme.typography.h4, { marginBottom: 16 }]}>
                Categoría: {getCategoryDetails(editingBudget.categoryId).name}
              </Text>
            )}

            <TextInput
              label="Monto Límite Mensual ($)"
              value={limitAmount}
              onChangeText={(txt) => {
                setLimitAmount(txt.replace(/[^0-9.]/g, ''));
                setErrorMsg(null);
              }}
              mode="outlined"
              keyboardType="numeric"
              style={styles.dialogInput}
            />

          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            {editingBudget && (
              <IconButton
                icon="delete"
                iconColor={theme.colors.error}
                onPress={() => handleDeleteBudget(editingBudget.id)}
                style={styles.deleteBtn}
              />
            )}
            <View style={styles.actionButtonsRow}>
              <Button onPress={() => setIsDialogVisible(false)} textColor={theme.customColors.textSecondary}>
                Cancelar
              </Button>
              <Button mode="contained" onPress={handleSaveBudget} style={{ marginLeft: 8 }}>
                Guardar
              </Button>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  summaryCard: {
    borderRadius: 16,
    marginBottom: 24,
  },
  summaryLabel: {
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  summaryAmount: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  budgetsList: {
    marginBottom: 16,
  },
  budgetItemCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    // Sombra sutil para emular la elevación de la tarjeta
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  budgetItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryName: {
    fontWeight: '600',
  },
  amountsInfo: {
    alignItems: 'flex-end',
  },
  limitLabel: {
    opacity: 0.8,
    marginTop: 2,
  },
  itemProgressBar: {
    height: 6,
    borderRadius: 3,
    width: '100%',
  },
  budgetItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  dialogLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dialogCategoryRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dialogSelectBtn: {
    marginRight: 8,
    borderRadius: 8,
  },
  dialogInput: {
    marginTop: 8,
  },
  dialogActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  deleteBtn: {
    margin: 0,
  },
  actionButtonsRow: {
    flexDirection: 'row',
  },
  childContainer: {
    marginTop: 10,
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginLeft: 6,
    alignSelf: 'stretch',
  },
  childHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  childName: {
    fontWeight: '500',
    fontSize: 13,
  },
  childAmountsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childProgressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    width: '100%',
  },
  childFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
