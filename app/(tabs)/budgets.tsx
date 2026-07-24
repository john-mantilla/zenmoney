/**
 * ZenMoney — Gestión de Presupuestos Mensuales
 *
 * Muestra el progreso de consumo frente a los límites mensuales por categoría,
 * con alertas visuales de colores y soporte completo para agregar, editar y
 * eliminar presupuestos en tiempo real.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Text, FAB, Card, ProgressBar, Button, Dialog, Portal, TextInput, ActivityIndicator, IconButton, HelperText, RadioButton, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { EmptyState, AmountDisplay, CategoryPickerMenu, NetworkStatusBar } from '@/src/presentation/components';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { Budget, BudgetProgress } from '@/src/domain/entities/Budget';
import { Category } from '@/src/domain/entities/Category';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
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
  const { selectedYear, selectedMonth } = useDateStore();

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
  const [budgetStartMode, setBudgetStartMode] = useState<'current' | 'future'>('current');
  const [futureMonthOffset, setFutureMonthOffset] = useState<number>(1); // 1 to 12 months ahead

  // Repositorios
  const budgetRepo = new HybridBudgetRepository();
  const transactionRepo = new HybridTransactionRepository();
  const categoryRepo = new HybridCategoryRepository();

  const loadData = async (force = false) => {
    try {
      // 1. Cargar todas las categorías
      const loadedCats = await categoryRepo.getAll(true);
      setCategories(loadedCats);
      if (loadedCats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(loadedCats[0].id);
      }

      // 2. Cargar presupuestos y propagar si es necesario
      const allBudgets = await budgetRepo.getAll();
      const monthlyBudgets: Budget[] = [];
      const targetValue = selectedYear * 12 + selectedMonth;
      const pastBudgets = allBudgets.filter(b => (b.year * 12 + b.month) <= targetValue);
      
      const latestByCategory: Record<string, { budget: Budget, value: number }> = {};
      for (const b of pastBudgets) {
        const bValue = b.year * 12 + b.month;
        if (!latestByCategory[b.categoryId] || latestByCategory[b.categoryId].value < bValue) {
          latestByCategory[b.categoryId] = { budget: b, value: bValue };
        }
      }

      for (const catId in latestByCategory) {
        // Clonación en memoria: simplemente agregamos el presupuesto histórico al mes actual
        // visualmente. Si el usuario lo edita, se guardará como un registro explícito.
        monthlyBudgets.push(latestByCategory[catId].budget);
      }

      // 3. Cargar transacciones del mes
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthStr = String(selectedMonth).padStart(2, '0');
      const startDate = `${selectedYear}-${monthStr}-01`;
      const endDate = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      
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
    }, [selectedYear, selectedMonth])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ─── CRUD Presupuestos ────────────────────────────────────────────────

  const openCreateDialog = () => {
    if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
    setLimitAmount('');
    setEditingBudget(null);
    setErrorMsg(null);
    setBudgetStartMode('current');
    setFutureMonthOffset(1);
    setIsDialogVisible(true);
  };

  const openEditDialog = (budget: Budget) => {
    setSelectedCategoryId(budget.categoryId);
    setLimitAmount(budget.amountLimit.toString());
    setEditingBudget(budget);
    setErrorMsg(null);
    setBudgetStartMode('current');
    setFutureMonthOffset(1);
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
      
      let targetYear = selectedYear;
      let targetMonth = selectedMonth;
      
      if (budgetStartMode === 'future') {
        let rawMonth = selectedMonth + futureMonthOffset;
        let rawYear = selectedYear;
        while (rawMonth > 12) {
          rawMonth -= 12;
          rawYear++;
        }
        targetMonth = rawMonth;
        targetYear = rawYear;
      }

      if (editingBudget && budgetStartMode === 'current') {
        // Verificar si es un presupuesto clonado en memoria (de un mes anterior)
        if (editingBudget.year === targetYear && editingBudget.month === targetMonth) {
          // Actualizar el presupuesto actual explícito
          await budgetRepo.update(editingBudget.id, {
            amountLimit: limitNum,
          });
        } else {
          // Es un clon en memoria, lo creamos explícitamente para este mes
          await budgetRepo.create({
            categoryId: selectedCategoryId,
            amountLimit: limitNum,
            year: targetYear,
            month: targetMonth,
          });
        }
      } else {
        // Verificar si la categoría ya tiene presupuesto en ese mes destino
        const existingTargetBudgets = await budgetRepo.getByMonth(targetYear, targetMonth);
        const exists = existingTargetBudgets.find(b => b.categoryId === selectedCategoryId);
        
        if (exists) {
          // Si existe explícitamente en el mes futuro, lo actualizamos
          await budgetRepo.update(exists.id, {
             amountLimit: limitNum
          });
        } else {
          // Crear como nuevo límite desde el mes destino
          await budgetRepo.create({
            categoryId: selectedCategoryId,
            amountLimit: limitNum,
            year: targetYear,
            month: targetMonth,
          });
        }
      }

      setIsDialogVisible(false);
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el presupuesto.');
      setIsLoading(false);
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    setIsLoading(true);
    try {
      // Solo borrar si es un presupuesto explícito de este mes, no un clon
      if (budget.year === selectedYear && budget.month === selectedMonth) {
        await budgetRepo.delete(budget.id);
      } else {
        // Si es un clon, borrarlo significa crear un límite de $0 o algo similar, pero 
        // para simplificar en ZenMoney: indicamos que no se puede borrar la historia pasada desde aquí.
        setErrorMsg('Este límite proviene de un mes anterior. Para eliminarlo en este mes, crea un límite nuevo de $0, o bórralo en el mes donde fue creado originalmente.');
        setIsLoading(false);
        return;
      }
      setIsDialogVisible(false);
      loadData(true);
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
        {/* ─── TARJETA CONSOLIDADA: RESUMEN DEL PRESUPUESTO ───────────────────────── */}
        <Surface style={[theme.shadows.sm, { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.outline + '30' }]}>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontWeight: '600', marginBottom: 6 }]}>
            Resumen del presupuesto
          </Text>
          
          <Text style={[theme.typography.amountLarge, { color: availableBudget >= 0 ? '#059669' : '#DC2626', fontSize: 32, fontWeight: '800' }]}>
            {availableBudget >= 0 ? '+' : ''}$ {Math.round(availableBudget).toLocaleString('es-CO')}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 14, fontWeight: '500' }]}>
            Disponible
          </Text>

          {/* Fila Gastado vs Límite Total */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
                Gastado
              </Text>
              <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                $ {Math.round(totalSpent).toLocaleString('es-CO')}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
                Límite total
              </Text>
              <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                $ {Math.round(totalBudgeted).toLocaleString('es-CO')}
              </Text>
            </View>
          </View>

          {/* Barra de Progreso Consolidada */}
          <CustomProgressBar progress={globalPercentage / 100} color={globalColor} />

          {/* Insight Inferior */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.outline + '15' }}>
            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
              Te quedan <Text style={{ fontWeight: '700', color: availableBudget >= 0 ? '#059669' : '#DC2626' }}>$ {Math.round(availableBudget).toLocaleString('es-CO')}</Text> para el resto del mes
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.customColors.textSecondary} />
          </View>
        </Surface>

        {/* ─── SECCIÓN: PRESUPUESTO POR CATEGORÍAS ────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
          <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
            Presupuesto por categorías
          </Text>
        </View>

        {budgetsProgress.length === 0 ? (
          <EmptyState
            icon="chart-arc"
            title="Sin presupuestos"
            description="Configura límites mensuales para llevar un control estricto de tus gastos."
            actionLabel="Configurar Primer Límite"
            onAction={openCreateDialog}
          />
        ) : (
          <View style={{ gap: 12, marginBottom: 80 }}>
            {budgetsProgress.map(bp => {
              const isExpanded = expandedCategories[bp.categoryId] || false;
              
              // Determinar color de etiqueta % consumido y barra
              let statusColor = '#059669'; // Verde
              if (bp.status === 'exceeded') {
                statusColor = '#DC2626'; // Rojo
              } else if (bp.status === 'warning') {
                statusColor = '#D97706'; // Naranja
              }

              return (
                <Surface
                  key={bp.id}
                  style={[theme.shadows.sm, { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: theme.colors.outline + '30' }]}
                >
                  {/* Encabezado Principal de la Categoría */}
                  <Pressable
                    onPress={bp.children.length > 0 ? () => toggleExpand(bp.categoryId) : (bp.hasDirectBudget && bp.budget ? () => openEditDialog(bp.budget!) : undefined)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      {/* Avatar e info de la categoría */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: bp.color + '20',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 10,
                          }}
                        >
                          <MaterialCommunityIcons name={(bp.icon as any) || 'tag-outline'} size={22} color={bp.color} />
                        </View>
                        
                        <View style={{ flex: 1 }}>
                          <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]} numberOfLines={1}>
                            {bp.name}
                          </Text>
                          <Text style={[theme.typography.caption, { fontWeight: '700', color: statusColor, marginTop: 1, fontSize: 11 }]}>
                            {bp.percentage}% consumido
                          </Text>
                        </View>
                      </View>

                      {/* Montos y acción de edición / expansión */}
                      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                            $ {Math.round(bp.spent).toLocaleString('es-CO')}
                          </Text>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
                            de $ {Math.round(bp.amountLimit).toLocaleString('es-CO')}
                          </Text>
                        </View>

                        {bp.hasDirectBudget && bp.budget && (
                          <IconButton
                            icon="pencil-outline"
                            size={18}
                            iconColor={theme.customColors.textSecondary}
                            style={{ margin: 0, padding: 0 }}
                            onPress={() => openEditDialog(bp.budget!)}
                          />
                        )}
                        {bp.children.length > 0 && (
                          <IconButton
                            icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            iconColor={theme.customColors.textSecondary}
                            style={{ margin: 0, padding: 0 }}
                            onPress={() => toggleExpand(bp.categoryId)}
                          />
                        )}
                      </View>
                    </View>

                    {/* Barra de progreso */}
                    <CustomProgressBar progress={bp.percentage / 100} color={statusColor} />

                    {/* Footer de remanente */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                      <Text style={[theme.typography.caption, { fontWeight: '600', color: bp.remaining < 0 ? '#DC2626' : '#059669', fontSize: 11 }]}>
                        {bp.remaining < 0 
                          ? `Excedido por $ ${Math.abs(bp.remaining).toLocaleString('es-CO')}` 
                          : `Restan $ ${bp.remaining.toLocaleString('es-CO')}`}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Subcategorías anidadas cuando está expandido */}
                  {isExpanded && bp.children.length > 0 && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.outline + '15', gap: 8 }}>
                      {bp.children.map(child => {
                        let childStatusColor = '#059669';
                        if (child.status === 'exceeded') childStatusColor = '#DC2626';
                        else if (child.status === 'warning') childStatusColor = '#D97706';

                        return (
                          <View key={child.id} style={{ paddingLeft: 8, paddingVertical: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={[theme.typography.caption, { fontWeight: '600', color: theme.colors.onSurface }]}>
                                {child.name} ({child.percentage}%)
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
                                  $ {Math.round(child.spent).toLocaleString('es-CO')}
                                </Text>
                                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 10 }]}>
                                  de $ {Math.round(child.amountLimit).toLocaleString('es-CO')}
                                </Text>
                                <IconButton
                                  icon="pencil-outline"
                                  size={14}
                                  iconColor={theme.customColors.textSecondary}
                                  style={{ margin: 0, padding: 0 }}
                                  onPress={() => openEditDialog(child.budget)}
                                />
                              </View>
                            </View>
                            <CustomProgressBar progress={child.percentage / 100} color={childStatusColor} />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Surface>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Botón Flotante FAB "+ Nuevo límite" (Verde Esmeralda del mockup) */}
      <FAB
        icon="plus"
        label="Nuevo límite"
        style={[styles.fab, { backgroundColor: '#059669', borderRadius: 28 }]}
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

            <View style={{ marginTop: 24 }}>
              <Text style={[styles.dialogLabel, theme.typography.caption]}>Inicia a partir de:</Text>
              <RadioButton.Group onValueChange={val => setBudgetStartMode(val as 'current' | 'future')} value={budgetStartMode}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <RadioButton value="current" color={theme.colors.primary} />
                  <Text style={theme.typography.body}>Este mes ({selectedYear}-{String(selectedMonth).padStart(2, '0')})</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <RadioButton value="future" color={theme.colors.primary} />
                  <Text style={theme.typography.body}>Mes futuro:</Text>
                </View>
              </RadioButton.Group>
              
              {budgetStartMode === 'future' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginLeft: 36 }}>
                  <IconButton icon="minus" size={20} onPress={() => setFutureMonthOffset(Math.max(1, futureMonthOffset - 1))} />
                  <Text style={{ fontWeight: 'bold', marginHorizontal: 8 }}>
                    +{futureMonthOffset} mes{futureMonthOffset > 1 ? 'es' : ''} 
                    {(() => {
                        let m = selectedMonth + futureMonthOffset;
                        let y = selectedYear;
                        while(m > 12) { m -= 12; y++; }
                        return ` (${y}-${String(m).padStart(2, '0')})`;
                    })()}
                  </Text>
                  <IconButton icon="plus" size={20} onPress={() => setFutureMonthOffset(Math.min(24, futureMonthOffset + 1))} />
                </View>
              )}
            </View>

          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            {editingBudget && (
              <IconButton
                icon="delete"
                iconColor={theme.colors.error}
                onPress={() => handleDeleteBudget(editingBudget)}
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
    paddingBottom: 130,
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
  childCardContainer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
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
