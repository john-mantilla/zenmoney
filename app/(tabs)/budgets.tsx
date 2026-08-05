/**
 * ZenMoney — Gestión de Presupuestos Mensuales
 *
 * Muestra el progreso de consumo frente a los límites mensuales por categoría,
 * con alertas visuales de colores y soporte completo para agregar, editar y
 * eliminar presupuestos en tiempo real.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Platform } from 'react-native';
import { Text, FAB, Card, ProgressBar, Button, Dialog, Portal, TextInput, ActivityIndicator, IconButton, HelperText, RadioButton, Surface, SegmentedButtons } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { EmptyState, AmountDisplay, CategoryPickerMenu, NetworkStatusBar, SmartBudgetSuggestionCard, CreateBudgetModal } from '@/src/presentation/components';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { SuggestRealisticBudget, RealisticBudgetSuggestion } from '@/src/domain/usecases/SuggestRealisticBudget';
import { Budget, BudgetProgress } from '@/src/domain/entities/Budget';
import { Category } from '@/src/domain/entities/Category';
import { Transaction } from '@/src/domain/entities/Transaction';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import { useFocusEffect } from 'expo-router';

export interface CreateBudgetData {
  categoryId: string;
  amount: number;
  scope: 'family' | 'individual';
  startMode: 'current' | 'future';
  futureOffset: number;
}

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
  parentDirectSpent: number;
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
  const [historicTxs, setHistoricTxs] = useState<Transaction[]>([]);
  const [calibrationSuggestions, setCalibrationSuggestions] = useState<RealisticBudgetSuggestion[]>([]);
  const [dismissedCalibrations, setDismissedCalibrations] = useState<Record<string, boolean>>({});

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
  const [selectedScope, setSelectedScope] = useState<'family' | 'individual'>('family');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'all' | 'family' | 'individual'>('all');
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

      // 2. Cargar presupuestos con Regla de Privacidad:
      // Solo cargar presupuestos compartidos familiares O presupuestos personales del usuario actual
      const { userProfile } = require('@/src/infrastructure/auth/authStore').useAuthStore.getState();
      const currentUserId = userProfile?.id;

      const allBudgets = await budgetRepo.getAll();
      const privacyBudgets = allBudgets.filter(b => 
        b.scope === 'family' || !b.ownerUserId || b.ownerUserId === currentUserId
      );

      const monthlyBudgets: Budget[] = [];
      const targetValue = selectedYear * 12 + selectedMonth;
      const pastBudgets = privacyBudgets.filter(b => (b.year * 12 + b.month) <= targetValue);
      
      const latestByKey: Record<string, { budget: Budget, value: number }> = {};
      for (const b of pastBudgets) {
        const bValue = b.year * 12 + b.month;
        const key = `${b.categoryId}_${b.scope || 'family'}_${b.ownerUserId || 'family'}`;
        if (!latestByKey[key] || latestByKey[key].value < bValue) {
          latestByKey[key] = { budget: b, value: bValue };
        }
      }

      for (const key in latestByKey) {
        monthlyBudgets.push(latestByKey[key].budget);
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

      const getDirectSpent = (catId: string, budget?: Budget) => {
        return monthlyExpenses
          .filter(tx => {
            if (tx.categoryId !== catId) return false;
            if (budget && budget.scope === 'individual' && budget.ownerUserId) {
              return tx.createdByUserId === budget.ownerUserId;
            }
            return true;
          })
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
      };

      const getCategoryAndSubcategoriesSpent = (catId: string, budget?: Budget) => {
        const subCatIds = loadedCats.filter(c => c.parentCategoryId === catId).map(c => c.id);
        const targetIds = [catId, ...subCatIds];
        return monthlyExpenses
          .filter(tx => {
            if (!tx.categoryId || !targetIds.includes(tx.categoryId)) return false;
            if (budget && budget.scope === 'individual' && budget.ownerUserId) {
              return tx.createdByUserId === budget.ownerUserId;
            }
            return true;
          })
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
      };

      // 4. Clasificar cada presupuesto y construir agrupaciones por categoría padre
      const rawProgress = monthlyBudgets.map(budget => {
        const cat = loadedCats.find(c => c.id === budget.categoryId);
        const isSubcategory = !!cat?.parentCategoryId;
        const parentId = isSubcategory ? cat!.parentCategoryId! : budget.categoryId;
        const spent = getDirectSpent(budget.categoryId, budget);
        
        return {
          budget,
          categoryId: budget.categoryId,
          parentId,
          isSubcategory,
          spent,
        };
      });

      const parentGroups: Record<string, {
        parentBudgets: typeof rawProgress[0][];
        subBudgets: typeof rawProgress[0][];
      }> = {};

      for (const p of rawProgress) {
        if (!parentGroups[p.parentId]) {
          parentGroups[p.parentId] = { parentBudgets: [], subBudgets: [] };
        }
        if (p.isSubcategory) {
          parentGroups[p.parentId].subBudgets.push(p);
        } else {
          parentGroups[p.parentId].parentBudgets.push(p);
        }
      }

      // 5. Construir los elementos árbol finales
      const treeItems: BudgetTreeItem[] = Object.entries(parentGroups).map(([parentId, group]) => {
        const parentCat = loadedCats.find(c => c.id === parentId);
        const name = parentCat ? parentCat.name : 'Desconocido';
        const icon = parentCat ? parentCat.icon : 'tag';
        const color = parentCat ? parentCat.color : '#9E9E9E';

        const parentBudgetItem = group.parentBudgets[0];

        let amountLimit = 0;
        let spent = 0;
        let hasDirectBudget = group.parentBudgets.length > 0;
        let budgetId = parentBudgetItem?.budget.id || `virtual-${parentId}`;

        if (group.subBudgets.length > 0) {
          amountLimit = group.subBudgets.reduce((sum, s) => sum + s.budget.amountLimit, 0);
          const parentDirectSpent = parentBudgetItem ? parentBudgetItem.spent : 0;
          spent = group.subBudgets.reduce((sum, s) => sum + s.spent, 0) + parentDirectSpent;
        } else {
          const p = parentBudgetItem!;
          amountLimit = p ? p.budget.amountLimit : 0;
          spent = p ? getCategoryAndSubcategoriesSpent(parentId, p.budget) : 0;
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

        const parentDirectSpent = parentBudgetItem ? parentBudgetItem.spent : 0;

        return {
          id: budgetId,
          categoryId: parentId,
          name,
          icon,
          color,
          hasDirectBudget,
          budget: parentBudgetItem?.budget,
          parentDirectSpent,
          amountLimit,
          spent,
          remaining,
          percentage,
          status,
          children,
        };
      });

      // 6. Cargar historial completo para calibración inteligente de presupuestos
      const allHistory = await transactionRepo.getAll({ status: 'confirmed' });
      setHistoricTxs(allHistory);

      const suggestions: RealisticBudgetSuggestion[] = [];
      for (const item of treeItems) {
        if (item.percentage >= 100 && item.amountLimit > 0) {
          const sug = SuggestRealisticBudget.execute(
            item.categoryId,
            item.amountLimit,
            allHistory,
            loadedCats,
            selectedYear,
            selectedMonth
          );
          if (sug) suggestions.push(sug);
        }
      }
      setCalibrationSuggestions(suggestions);

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
    setSelectedScope('family');
    setEditingBudget(null);
    setErrorMsg(null);
    setBudgetStartMode('current');
    setFutureMonthOffset(1);
    setIsDialogVisible(true);
  };

  const openEditDialog = (budget: Budget) => {
    setSelectedCategoryId(budget.categoryId);
    setLimitAmount(budget.amountLimit.toString());
    setSelectedScope(budget.scope || 'family');
    setEditingBudget(budget);
    setErrorMsg(null);
    setBudgetStartMode('current');
    setFutureMonthOffset(1);
    setIsDialogVisible(true);
  };

  const handleSaveBudget = async (data?: CreateBudgetData) => {
    const categoryIdToUse = data ? data.categoryId : selectedCategoryId;
    const limitNum = data ? data.amount : parseFloat(limitAmount);
    const scopeToUse = data ? data.scope : selectedScope;
    const startModeToUse = data ? data.startMode : budgetStartMode;
    const offsetToUse = data ? data.futureOffset : futureMonthOffset;

    if (!limitNum || isNaN(limitNum) || limitNum <= 0) {
      setErrorMsg('Por favor ingresa un límite de dinero válido mayor a cero.');
      return;
    }

    setIsLoading(true);
    try {
      let targetYear = selectedYear;
      let targetMonth = selectedMonth;
      
      if (startModeToUse === 'future') {
        let rawMonth = selectedMonth + offsetToUse;
        let rawYear = selectedYear;
        while (rawMonth > 12) {
          rawMonth -= 12;
          rawYear++;
        }
        targetMonth = rawMonth;
        targetYear = rawYear;
      }

      const { userProfile } = require('@/src/infrastructure/auth/authStore').useAuthStore.getState();
      const currentUserId = userProfile?.id;
      const ownerUserId = scopeToUse === 'individual' ? currentUserId : null;

      if (editingBudget && startModeToUse === 'current') {
        if (editingBudget.year === targetYear && editingBudget.month === targetMonth) {
          await budgetRepo.update(editingBudget.id, {
            amountLimit: limitNum,
            scope: scopeToUse,
            ownerUserId,
          });
        } else {
          await budgetRepo.create({
            categoryId: categoryIdToUse,
            amountLimit: limitNum,
            year: targetYear,
            month: targetMonth,
            scope: scopeToUse,
            ownerUserId,
          });
        }
      } else {
        const existingTargetBudgets = await budgetRepo.getByMonth(targetYear, targetMonth);
        const exists = existingTargetBudgets.find(b => b.categoryId === categoryIdToUse && b.scope === scopeToUse && b.ownerUserId === ownerUserId);
        
        if (exists) {
          await budgetRepo.update(exists.id, {
             amountLimit: limitNum,
             scope: scopeToUse,
             ownerUserId,
          });
        } else {
          await budgetRepo.create({
            categoryId: categoryIdToUse,
            amountLimit: limitNum,
            year: targetYear,
            month: targetMonth,
            scope: scopeToUse,
            ownerUserId,
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

  // Helper para verificar si un ítem o subcategoría coincide con el filtro activo
  const matchesScopeFilter = (bp: BudgetTreeItem) => {
    if (selectedScopeFilter === 'all') return true;
    if (selectedScopeFilter === 'family') {
      const isParentFamily = bp.hasDirectBudget && (bp.budget?.scope === 'family' || !bp.budget?.ownerUserId);
      const hasFamilyChild = bp.children.some(c => c.budget.scope === 'family' || !c.budget.ownerUserId);
      return isParentFamily || hasFamilyChild;
    }
    if (selectedScopeFilter === 'individual') {
      const isParentIndividual = bp.hasDirectBudget && bp.budget?.scope === 'individual';
      const hasIndividualChild = bp.children.some(c => c.budget.scope === 'individual');
      return isParentIndividual || hasIndividualChild;
    }
    return true;
  };

  // Cálculos consolidados globales dinámicos según el filtro activo (HomeBudget style)
  const calculateScopeTotals = () => {
    let totalLimit = 0;
    let totalSpentVal = 0;

    const filteredTree = budgetsProgress.filter(matchesScopeFilter);

    for (const bp of filteredTree) {
      const visibleChildren = bp.children.filter(child => {
        if (selectedScopeFilter === 'family') return child.budget.scope === 'family' || !child.budget.ownerUserId;
        if (selectedScopeFilter === 'individual') return child.budget.scope === 'individual';
        return true;
      });

      const isParentMatching = selectedScopeFilter === 'all' ||
        (selectedScopeFilter === 'family' && bp.hasDirectBudget && (bp.budget?.scope === 'family' || !bp.budget?.ownerUserId)) ||
        (selectedScopeFilter === 'individual' && bp.hasDirectBudget && bp.budget?.scope === 'individual');

      if (visibleChildren.length > 0 && selectedScopeFilter !== 'all') {
        totalLimit += visibleChildren.reduce((sum, c) => sum + c.amountLimit, 0);
        totalSpentVal += visibleChildren.reduce((sum, c) => sum + c.spent, 0);
        if (isParentMatching && bp.budget) {
          totalLimit += bp.budget.amountLimit;
          totalSpentVal += bp.parentDirectSpent;
        }
      } else {
        totalLimit += bp.amountLimit;
        totalSpentVal += bp.spent;
      }
    }

    return { totalLimit, totalSpentVal };
  };

  const { totalLimit: totalBudgeted, totalSpentVal: totalSpent } = calculateScopeTotals();
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
        {/* Banner(s) de Calibración Inteligente de Presupuesto */}
        {calibrationSuggestions.map((sug) => {
          if (dismissedCalibrations[sug.categoryId]) return null;
          return (
            <SmartBudgetSuggestionCard
              key={sug.categoryId}
              suggestion={sug}
              onApplySuggestion={async (newAmount) => {
                const targetItem = budgetsProgress.find((bp) => bp.categoryId === sug.categoryId);
                if (targetItem?.budget) {
                  await budgetRepo.update(targetItem.budget.id, { amountLimit: newAmount });
                  loadData(true);
                }
              }}
              onDismiss={() => {
                setDismissedCalibrations((prev) => ({ ...prev, [sug.categoryId]: true }));
              }}
            />
          );
        })}

        {/* ─── TARJETA CONSOLIDADA: RESUMEN DEL PRESUPUESTO ───────────────────────── */}
        <Surface style={[theme.shadows.sm, { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.outline + '30' }]}>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontWeight: '600', marginBottom: 6 }]}>
            Resumen del presupuesto {selectedScopeFilter === 'individual' ? '(Mis Personales)' : selectedScopeFilter === 'family' ? '(Compartidos)' : '(Todos)'}
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

        {/* ─── SECCIÓN: PRESUPUESTO POR CATEGORÍAS Y FILTRO DE ÁMBITO ──────────── */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
              Presupuesto por categorías
            </Text>
          </View>
          <SegmentedButtons
            value={selectedScopeFilter}
            onValueChange={(val: string) => setSelectedScopeFilter(val as any)}
            buttons={[
              { value: 'all', label: 'Todos', icon: 'chart-arc', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
              { value: 'family', label: 'Compartidos', icon: 'account-group-outline', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
              { value: 'individual', label: 'Personales', icon: 'lock-outline', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
            ]}
            density="small"
          />
        </View>

        {/* Helper de coincidencia de ámbito considerando subcategorías hijas */}
        {(() => {
          const matchesScopeFilter = (bp: typeof budgetsProgress[0]) => {
            if (selectedScopeFilter === 'all') return true;
            if (selectedScopeFilter === 'family') {
              const isParentFamily = bp.hasDirectBudget && (bp.budget?.scope === 'family' || !bp.budget?.ownerUserId);
              const hasFamilyChild = bp.children.some(c => c.budget.scope === 'family' || !c.budget.ownerUserId);
              return isParentFamily || hasFamilyChild;
            }
            if (selectedScopeFilter === 'individual') {
              const isParentIndividual = bp.hasDirectBudget && bp.budget?.scope === 'individual';
              const hasIndividualChild = bp.children.some(c => c.budget.scope === 'individual');
              return isParentIndividual || hasIndividualChild;
            }
            return true;
          };

          const filteredTree = budgetsProgress.filter(matchesScopeFilter);

          if (filteredTree.length === 0) {
            return (
              <EmptyState
                icon="chart-arc"
                title="Sin presupuestos en este filtro"
                description="No hay presupuestos configurados para el filtro seleccionado."
                actionLabel="Configurar Límite"
                onAction={openCreateDialog}
              />
            );
          }

          return (
            <View style={{ gap: 12, marginBottom: 80 }}>
              {filteredTree.map(bp => {
                const visibleChildren = bp.children.filter(child => {
                  if (selectedScopeFilter === 'family') return child.budget.scope === 'family' || !child.budget.ownerUserId;
                  if (selectedScopeFilter === 'individual') return child.budget.scope === 'individual';
                  return true;
                });

                const hasChildren = visibleChildren.length > 0;
                // Si estamos en un filtro específico, expandir automáticamente para mostrar las subcategorías
                const isExpanded = expandedCategories[bp.categoryId] !== undefined 
                  ? expandedCategories[bp.categoryId] 
                  : (selectedScopeFilter !== 'all' && hasChildren);

                const isParentMatching = selectedScopeFilter === 'all' || 
                  (selectedScopeFilter === 'family' && bp.hasDirectBudget && (bp.budget?.scope === 'family' || !bp.budget?.ownerUserId)) ||
                  (selectedScopeFilter === 'individual' && bp.hasDirectBudget && bp.budget?.scope === 'individual');

                let displayLimit = bp.amountLimit;
                let displaySpent = bp.spent;

                if (hasChildren && selectedScopeFilter !== 'all') {
                  displayLimit = visibleChildren.reduce((sum, c) => sum + c.amountLimit, 0);
                  const parentDirectSpent = isParentMatching && bp.budget ? bp.parentDirectSpent : 0;
                  displaySpent = visibleChildren.reduce((sum, c) => sum + c.spent, 0) + parentDirectSpent;
                  if (isParentMatching && bp.budget) {
                    displayLimit += bp.budget.amountLimit;
                  }
                }

                const displayRemaining = displayLimit - displaySpent;
                const displayPercentage = displayLimit > 0 ? Math.round((displaySpent / displayLimit) * 100) : 0;

                let statusColor = '#059669';
                if (displayPercentage >= 100) statusColor = '#DC2626';
                else if (displayPercentage >= 80) statusColor = '#D97706';

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
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]} numberOfLines={1}>
                              {bp.name}
                            </Text>
                            {bp.budget && (
                              <View style={{ backgroundColor: bp.budget.scope === 'individual' ? '#05966915' : theme.colors.primaryContainer + '40', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: bp.budget.scope === 'individual' ? '#059669' : theme.colors.primary }}>
                                  {bp.budget.scope === 'individual' ? '🔒 Personal' : '🌐 Familiar'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[theme.typography.caption, { fontWeight: '700', color: statusColor, marginTop: 1, fontSize: 11 }]}>
                            {bp.percentage}% consumido
                          </Text>
                        </View>
                      </View>

                      {/* Montos y acción de edición / expansión */}
                      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                            $ {Math.round(displaySpent).toLocaleString('es-CO')}
                          </Text>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
                            de $ {Math.round(displayLimit).toLocaleString('es-CO')}
                          </Text>
                        </View>

                        {bp.hasDirectBudget && bp.budget && isParentMatching && (
                          <IconButton
                            icon="pencil-outline"
                            size={18}
                            iconColor={theme.customColors.textSecondary}
                            style={{ margin: 0, padding: 0 }}
                            onPress={() => openEditDialog(bp.budget!)}
                          />
                        )}
                        {hasChildren && (
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
                    <CustomProgressBar progress={displayPercentage / 100} color={statusColor} />

                    {/* Footer de remanente */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                      <Text style={[theme.typography.caption, { fontWeight: '600', color: displayRemaining < 0 ? '#DC2626' : '#059669', fontSize: 11 }]}>
                        {displayRemaining < 0 
                          ? `Excedido por $ ${Math.abs(displayRemaining).toLocaleString('es-CO')}` 
                          : `Restan $ ${displayRemaining.toLocaleString('es-CO')}`}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Subcategorías anidadas cuando está expandido */}
                  {isExpanded && hasChildren && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.outline + '15', gap: 8 }}>
                      {visibleChildren.map(child => {
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
        );
      })()}
      </ScrollView>

      {/* Botón Flotante FAB "+ Nuevo límite" (Verde Esmeralda del mockup) */}
      <FAB
        icon="plus"
        label="Nuevo límite"
        style={[styles.fab, { backgroundColor: '#059669', borderRadius: 28 }]}
        color="#FFFFFF"
        onPress={openCreateDialog}
      />

      {/* ─── MODAL IMPECCABLE: CREAR / EDITAR PRESUPUESTO O LÍMITE MENSUAL ───── */}
      <CreateBudgetModal
        visible={isDialogVisible}
        onClose={() => {
          setIsDialogVisible(false);
          setEditingBudget(null);
        }}
        onSave={async (data) => {
          await handleSaveBudget(data);
        }}
        onDelete={
          editingBudget
            ? async () => {
                await handleDeleteBudget(editingBudget);
              }
            : undefined
        }
        editingBudget={editingBudget}
        categories={categories}
        historicTransactions={historicTxs}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />
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
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 880 : '100%',
    alignSelf: 'center',
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
