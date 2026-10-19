/**
 * ZenMoney — Gestión de Presupuestos Mensuales
 *
 * Muestra el progreso de consumo frente a los límites mensuales por categoría,
 * con alertas visuales de colores y soporte completo para agregar, editar y
 * eliminar presupuestos en tiempo real.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Platform } from 'react-native';
import { Text, FAB, Card, ProgressBar, Button, Dialog, Portal, TextInput, ActivityIndicator, IconButton, HelperText, RadioButton, Surface, SegmentedButtons, Chip } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { EmptyState, AmountDisplay, CategoryPickerMenu, NetworkStatusBar, SmartBudgetSuggestionCard, CreateBudgetModal, CreateAtomicHabitModal } from '@/src/presentation/components';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { SuggestRealisticBudget, RealisticBudgetSuggestion } from '@/src/domain/usecases/SuggestRealisticBudget';
import { CalculateBudgetRollover } from '@/src/domain/usecases/CalculateBudgetRollover';
import { ResolveEffectiveBudget, ResolvedBudgetItem } from '@/src/domain/usecases/ResolveEffectiveBudget';
import { AtomicPacingService } from '@/src/domain/services/AtomicPacingService';
import { useHabitSettingsStore } from '@/src/infrastructure/state/habitSettingsStore';
import { Budget, BudgetProgress } from '@/src/domain/entities/Budget';
import { Category } from '@/src/domain/entities/Category';
import { Transaction } from '@/src/domain/entities/Transaction';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import { useFocusEffect } from 'expo-router';
import { AppAlert } from '@/src/presentation/services/AppAlert';
import { hapticSuccess } from '@/src/infrastructure/utils/haptics';
import { BudgetSyncHelper } from '@/src/infrastructure/services/BudgetSyncHelper';

export interface CreateBudgetData {
  categoryId: string;
  amount: number;
  scope: 'family' | 'individual';
  startMode: 'current' | 'future';
  futureOffset: number;
  hasRollover?: boolean;
  isOverride?: boolean;
  overrideReason?: string;
}

interface BudgetTreeChild {
  id: string;
  categoryId: string;
  name: string;
  amountLimit: number; // Límite efectivo (base + rollover)
  baseLimit?: number;
  rolloverAmount?: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  budget: Budget;
  isOverride?: boolean;
  overrideReason?: string;
  baseMasterLimit?: number;
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
  amountLimit: number; // Límite efectivo (base + rollover)
  baseLimit?: number;
  rolloverAmount?: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  children: BudgetTreeChild[];
  isOverride?: boolean;
  overrideReason?: string;
  baseMasterLimit?: number;
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

  // Estados para Hábitos Atómicos
  const { settings: habitSettings, isCategoryActive } = useHabitSettingsStore();
  const [atomicModalVisible, setAtomicModalVisible] = useState(false);
  const [selectedAtomicBudget, setSelectedAtomicBudget] = useState<{
    budgetId: string;
    categoryId: string;
    categoryName: string;
    monthlyLimit: number;
  } | null>(null);

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

      // 2.1. Resolver presupuestos efectivos del mes actual (con soporte de Overrides)
      const resolvedCurrentMonth = ResolveEffectiveBudget.resolveAll(privacyBudgets, selectedYear, selectedMonth);
      const monthlyBudgets: Budget[] = resolvedCurrentMonth.map(r => r.budget);
      const resolvedOverridesByKey: Record<string, ResolvedBudgetItem> = {};
      for (const item of resolvedCurrentMonth) {
        resolvedOverridesByKey[item.budget.categoryId] = item;
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

      // 3.1. Cargar transacciones y presupuestos del mes anterior para calcular el Rollover
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevMonthStr = String(prevMonth).padStart(2, '0');
      const prevStartDate = `${prevYear}-${prevMonthStr}-01`;
      const prevEndDate = `${prevYear}-${prevMonthStr}-${String(prevLastDay).padStart(2, '0')}`;

      const pastMonthExpenses = await transactionRepo.getAll({
        startDate: prevStartDate,
        endDate: prevEndDate,
        type: 'expense',
        status: 'confirmed'
      });

      const resolvedPrevMonth = ResolveEffectiveBudget.resolveAll(privacyBudgets, prevYear, prevMonth);
      const latestByKeyPrev: Record<string, { budget: Budget }> = {};
      for (const item of resolvedPrevMonth) {
        const key = `${item.budget.categoryId}_${item.budget.scope || 'family'}_${item.budget.ownerUserId || 'family'}`;
        latestByKeyPrev[key] = { budget: item.budget };
      }

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

        // 5.1. Calcular subcategorías con soporte de Rollover
        const children: BudgetTreeChild[] = group.subBudgets.map(s => {
          const subCat = loadedCats.find(c => c.id === s.categoryId);
          const subSpent = s.spent;

          let subBaseLimit = s.budget.amountLimit;
          let subRolloverAmount = 0;
          let subLimit = s.budget.amountLimit;

          if (s.budget.hasRollover) {
            const sKey = `${s.budget.categoryId}_${s.budget.scope || 'family'}_${s.budget.ownerUserId || 'family'}`;
            const pastSubBudget = latestByKeyPrev[sKey]?.budget;
            const rolloverRes = CalculateBudgetRollover.execute({
              budget: s.budget,
              pastMonthBudget: pastSubBudget,
              pastMonthExpenses,
              categories: loadedCats,
            });
            subBaseLimit = rolloverRes.baseLimit;
            subRolloverAmount = rolloverRes.rolloverAmount;
            subLimit = rolloverRes.effectiveLimit;
          }

          const subRemaining = subLimit - subSpent;
          const subPercentage = subLimit > 0 ? Math.round((subSpent / subLimit) * 100) : 0;
          
          let subStatus: 'ok' | 'warning' | 'exceeded' = 'ok';
          if (subPercentage >= 100) {
            subStatus = 'exceeded';
          } else if (subPercentage >= 80) {
            subStatus = 'warning';
          }

          const resolvedSub = resolvedOverridesByKey[s.categoryId];
          return {
            id: s.budget.id,
            categoryId: s.categoryId,
            name: subCat ? subCat.name : 'Subcategoría',
            amountLimit: subLimit,
            baseLimit: subBaseLimit,
            rolloverAmount: subRolloverAmount,
            spent: subSpent,
            remaining: subRemaining,
            percentage: subPercentage,
            status: subStatus,
            budget: s.budget,
            isOverride: resolvedSub?.isOverride,
            overrideReason: resolvedSub?.overrideReason,
            baseMasterLimit: resolvedSub?.baseMasterBudget?.amountLimit,
          };
        }).sort((a, b) => b.percentage - a.percentage);

        // 5.2. Calcular presupuesto consolidado o del padre con soporte de Rollover
        let amountLimit = 0;
        let baseLimit = 0;
        let rolloverAmount = 0;
        let spent = 0;
        let hasDirectBudget = group.parentBudgets.length > 0;
        let budgetId = parentBudgetItem?.budget.id || `virtual-${parentId}`;

        if (parentBudgetItem) {
          const pBudget = parentBudgetItem.budget;
          baseLimit = pBudget.amountLimit;
          amountLimit = pBudget.amountLimit;

          if (pBudget.hasRollover) {
            const pKey = `${pBudget.categoryId}_${pBudget.scope || 'family'}_${pBudget.ownerUserId || 'family'}`;
            const pastParentBudget = latestByKeyPrev[pKey]?.budget;
            const rolloverRes = CalculateBudgetRollover.execute({
              budget: pBudget,
              pastMonthBudget: pastParentBudget,
              pastMonthExpenses,
              categories: loadedCats,
            });
            baseLimit = rolloverRes.baseLimit;
            rolloverAmount = rolloverRes.rolloverAmount;
            amountLimit = rolloverRes.effectiveLimit;
          }
          spent = getCategoryAndSubcategoriesSpent(parentId, pBudget);
        } else if (children.length > 0) {
          baseLimit = children.reduce((sum, c) => sum + (c.baseLimit ?? c.amountLimit), 0);
          rolloverAmount = children.reduce((sum, c) => sum + (c.rolloverAmount ?? 0), 0);
          amountLimit = children.reduce((sum, c) => sum + c.amountLimit, 0);
          spent = getCategoryAndSubcategoriesSpent(parentId, group.subBudgets[0]?.budget);
        }

        const remaining = amountLimit - spent;
        const percentage = amountLimit > 0 ? Math.round((spent / amountLimit) * 100) : 0;
        
        let status: 'ok' | 'warning' | 'exceeded' = 'ok';
        if (percentage >= 100) {
          status = 'exceeded';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        const parentDirectSpent = parentBudgetItem ? parentBudgetItem.spent : 0;
        const resolvedParent = parentBudgetItem ? resolvedOverridesByKey[parentId] : undefined;

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
          baseLimit,
          rolloverAmount,
          spent,
          remaining,
          percentage,
          status,
          children,
          isOverride: resolvedParent?.isOverride,
          overrideReason: resolvedParent?.overrideReason,
          baseMasterLimit: resolvedParent?.baseMasterBudget?.amountLimit,
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

      // El Widget Android SIEMPRE debe reflejar el mes actual en curso (nunca meses pasados o futuros explorados)
      const now = new Date();
      const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === (now.getMonth() + 1);

      if (isCurrentMonth) {
        let widgetTotalLimit = 0;
        let widgetTotalSpent = 0;
        for (const item of treeItems) {
          widgetTotalLimit += item.amountLimit;
          widgetTotalSpent += item.spent;
        }
        const widgetAvailable = Math.max(0, widgetTotalLimit - widgetTotalSpent);
        const widgetPercentage = widgetTotalLimit > 0 ? (widgetTotalSpent / widgetTotalLimit) * 100 : 0;
        BudgetSyncHelper.syncMonthlyBudget(widgetAvailable, widgetPercentage).catch(() => {});
      } else {
        // Si el usuario está explorando otro mes en la app, mantener el widget anclado al mes en curso actual
        BudgetSyncHelper.syncMonthlyBudget().catch(() => {});
      }
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
    const hasRolloverToUse = data ? data.hasRollover : (editingBudget ? editingBudget.hasRollover : false);
    const isOverrideToUse = data ? Boolean(data.isOverride) : false;
    const overrideReasonToUse = data ? data.overrideReason : undefined;

    if (!limitNum || isNaN(limitNum) || limitNum <= 0) {
      setErrorMsg('Por favor ingresa un límite de dinero válido mayor a cero.');
      return;
    }

    setIsLoading(true);
    try {
      let targetYear = selectedYear;
      let targetMonth = selectedMonth;
      
      if (!isOverrideToUse && startModeToUse === 'future') {
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

      if (isOverrideToUse) {
        // Modo Anulación Específica (Budget Override): Solo aplica para este mes puntual
        const targetBudgets = await budgetRepo.getByMonth(targetYear, targetMonth);
        const existingOverride = targetBudgets.find(
          b => b.categoryId === categoryIdToUse && b.scope === scopeToUse && b.ownerUserId === ownerUserId && b.isOverride === true
        );

        if (existingOverride) {
          await budgetRepo.update(existingOverride.id, {
            amountLimit: limitNum,
            scope: scopeToUse,
            ownerUserId,
            hasRollover: hasRolloverToUse,
            isOverride: true,
            overrideReason: overrideReasonToUse,
          });
        } else {
          await budgetRepo.create({
            categoryId: categoryIdToUse,
            amountLimit: limitNum,
            year: targetYear,
            month: targetMonth,
            scope: scopeToUse,
            ownerUserId,
            hasRollover: hasRolloverToUse,
            isOverride: true,
            overrideReason: overrideReasonToUse,
          });
        }
      } else {
        // Modo Regla Maestra Recurrente
        if (editingBudget && startModeToUse === 'current' && !editingBudget.isOverride) {
          if (editingBudget.year === targetYear && editingBudget.month === targetMonth) {
            await budgetRepo.update(editingBudget.id, {
              amountLimit: limitNum,
              scope: scopeToUse,
              ownerUserId,
              hasRollover: hasRolloverToUse,
              isOverride: false,
              overrideReason: null,
            });
          } else {
            await budgetRepo.create({
              categoryId: categoryIdToUse,
              amountLimit: limitNum,
              year: targetYear,
              month: targetMonth,
              scope: scopeToUse,
              ownerUserId,
              hasRollover: hasRolloverToUse,
              isOverride: false,
            });
          }
        } else {
          const existingTargetBudgets = await budgetRepo.getByMonth(targetYear, targetMonth);
          const existingMaster = existingTargetBudgets.find(
            b => b.categoryId === categoryIdToUse && b.scope === scopeToUse && b.ownerUserId === ownerUserId && !b.isOverride
          );
          
          if (existingMaster) {
            await budgetRepo.update(existingMaster.id, {
              amountLimit: limitNum,
              scope: scopeToUse,
              ownerUserId,
              hasRollover: hasRolloverToUse,
              isOverride: false,
              overrideReason: null,
            });
          } else {
            await budgetRepo.create({
              categoryId: categoryIdToUse,
              amountLimit: limitNum,
              year: targetYear,
              month: targetMonth,
              scope: scopeToUse,
              ownerUserId,
              hasRollover: hasRolloverToUse,
              isOverride: false,
            });
          }
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
      if (budget.isOverride) {
        // Es un ajuste extraordinario puntual: simplemente se elimina y vuelve a la regla maestra
        await budgetRepo.delete(budget.id);
        AppAlert.alert('Ajuste Eliminado', 'Se eliminó el límite extraordinario y se restauró la regla maestra habitual.');
      } else if (budget.year === selectedYear && budget.month === selectedMonth) {
        await budgetRepo.delete(budget.id);
      } else {
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

  const consolidatedSafeToSpend = AtomicPacingService.calculateSafeToSpend(
    totalBudgeted,
    totalSpent,
    new Date(),
    {
      enableWeekendWeight: habitSettings.weekendWeightEnabled,
      weekendWeightRatio: habitSettings.weekendWeightRatio,
      isGloballyEnabled: habitSettings.isGloballyEnabled,
    }
  );

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
                try {
                  setIsLoading(true);
                  const { userProfile } = require('@/src/infrastructure/auth/authStore').useAuthStore.getState();
                  const currentUserId = userProfile?.id;

                  // 1. Buscar si existe un presupuesto objetivo en los ítems principales o en subcategorías
                  let targetBudget: Budget | undefined = undefined;
                  for (const bp of budgetsProgress) {
                    if (bp.categoryId === sug.categoryId && bp.budget) {
                      targetBudget = bp.budget;
                      break;
                    }
                    const child = bp.children.find(c => c.categoryId === sug.categoryId || c.budget.categoryId === sug.categoryId);
                    if (child?.budget) {
                      targetBudget = child.budget;
                      break;
                    }
                  }

                  const scopeToUse = targetBudget?.scope || 'family';
                  const ownerUserId = scopeToUse === 'individual' ? (targetBudget?.ownerUserId || currentUserId) : null;

                  // 2. Verificar si ya existe un registro explícito de presupuesto para este mes y año
                  const existingTargetBudgets = await budgetRepo.getByMonth(selectedYear, selectedMonth);
                  const exists = existingTargetBudgets.find(b => 
                    b.categoryId === sug.categoryId && 
                    b.scope === scopeToUse && 
                    (scopeToUse === 'family' || b.ownerUserId === ownerUserId)
                  );

                  if (exists) {
                    await budgetRepo.update(exists.id, {
                      amountLimit: newAmount,
                      scope: scopeToUse,
                      ownerUserId,
                    });
                  } else {
                    await budgetRepo.create({
                      categoryId: sug.categoryId,
                      amountLimit: newAmount,
                      year: selectedYear,
                      month: selectedMonth,
                      scope: scopeToUse,
                      ownerUserId,
                    });
                  }

                  // 3. Ocultar la sugerencia aplicada
                  setDismissedCalibrations(prev => ({ ...prev, [sug.categoryId]: true }));
                  
                  // Feedback táctil y visual
                  hapticSuccess();
                  AppAlert.alert('Presupuesto Actualizado', `Se ha aplicado la meta de $${newAmount.toLocaleString('es-CO')} a ${sug.categoryName} exitosamente.`);
                  
                  await loadData(true);
                } catch (err) {
                  console.error('[Budgets] Error al aplicar sugerencia inteligente:', err);
                  setErrorMsg('No se pudo aplicar la sugerencia de presupuesto.');
                } finally {
                  setIsLoading(false);
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

          {/* Ritmo Atómico Consolidado (Safe-to-Spend Hoy) */}
          {habitSettings.isGloballyEnabled && totalBudgeted > 0 && (
            <View
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                backgroundColor: theme.colors.primary + '10',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderColor: theme.colors.primary + '25',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <MaterialCommunityIcons name="lightning-bolt" size={22} color={theme.colors.primary} />
                <View>
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }]}>
                    SAFE-TO-SPEND (HOY)
                  </Text>
                  <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                    $ {Math.round(consolidatedSafeToSpend.dailySafeToSpend).toLocaleString('es-CO')}
                    <Text style={{ fontSize: 11, fontWeight: '400', color: theme.customColors.textSecondary }}> / día</Text>
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Chip
                  compact
                  textStyle={{
                    fontSize: 10,
                    fontWeight: '700',
                    lineHeight: 12,
                    color:
                      consolidatedSafeToSpend.pacingStatus === 'ahead' ? '#059669'
                      : consolidatedSafeToSpend.pacingStatus === 'on_track' ? '#2563EB'
                      : consolidatedSafeToSpend.pacingStatus === 'accelerated' ? '#D97706'
                      : '#DC2626'
                  }}
                  style={{
                    backgroundColor:
                      consolidatedSafeToSpend.pacingStatus === 'ahead' ? '#05966915'
                      : consolidatedSafeToSpend.pacingStatus === 'on_track' ? '#2563EB15'
                      : consolidatedSafeToSpend.pacingStatus === 'accelerated' ? '#D9770615'
                      : '#DC262615'
                  }}
                >
                  {consolidatedSafeToSpend.pacingStatus === 'ahead' ? 'Holgado'
                    : consolidatedSafeToSpend.pacingStatus === 'on_track' ? 'En Ritmo'
                    : consolidatedSafeToSpend.pacingStatus === 'accelerated' ? 'Acelerado'
                    : 'Agotado'}
                </Chip>
                <Text style={{ fontSize: 10, color: theme.customColors.textSecondary }}>
                  {consolidatedSafeToSpend.daysRemaining} días rest. {consolidatedSafeToSpend.isWeekend ? '• Fin de sem.' : ''}
                </Text>
              </View>
            </View>
          )}

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

                const catPacing = (habitSettings.isGloballyEnabled && isCategoryActive(bp.categoryId) && displayLimit > 0)
                  ? AtomicPacingService.calculateSafeToSpend(
                      displayLimit,
                      displaySpent,
                      new Date(),
                      {
                        enableWeekendWeight: habitSettings.weekendWeightEnabled,
                        weekendWeightRatio: habitSettings.weekendWeightRatio,
                        isGloballyEnabled: habitSettings.isGloballyEnabled,
                        isCategoryEnabled: true,
                      }
                    )
                  : null;

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
                            {bp.rolloverAmount !== undefined && bp.rolloverAmount !== 0 && (
                              <View style={{
                                backgroundColor: bp.rolloverAmount > 0 ? '#05966915' : '#DC262615',
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                <MaterialCommunityIcons
                                  name="swap-horizontal-bold"
                                  size={11}
                                  color={bp.rolloverAmount > 0 ? '#059669' : '#DC2626'}
                                />
                                <Text style={{
                                  fontSize: 9,
                                  fontWeight: '700',
                                  color: bp.rolloverAmount > 0 ? '#059669' : '#DC2626'
                                }}>
                                  {bp.rolloverAmount > 0
                                    ? `+${Math.round(bp.rolloverAmount).toLocaleString('es-CO')} Rollover`
                                    : `${Math.round(bp.rolloverAmount).toLocaleString('es-CO')} Rollover`}
                                </Text>
                              </View>
                            )}
                            {bp.isOverride && (
                              <View style={{
                                backgroundColor: '#7C3AED18',
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                <MaterialCommunityIcons
                                  name="star"
                                  size={11}
                                  color="#7C3AED"
                                />
                                <Text style={{
                                  fontSize: 9,
                                  fontWeight: '700',
                                  color: '#7C3AED'
                                }}>
                                  {bp.overrideReason ? bp.overrideReason : 'Puntual'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[theme.typography.caption, { fontWeight: '700', color: statusColor, marginTop: 1, fontSize: 11 }]}>
                            {bp.percentage}% consumido
                            {bp.rolloverAmount !== undefined && bp.rolloverAmount !== 0 && bp.baseLimit !== undefined && (
                              <Text style={{ fontWeight: '400', color: theme.customColors.textSecondary }}>
                                {' '}• Base: ${Math.round(bp.baseLimit).toLocaleString('es-CO')}
                              </Text>
                            )}
                            {bp.isOverride && bp.baseMasterLimit !== undefined && (
                              <Text style={{ fontWeight: '400', color: '#7C3AED' }}>
                                {' '}• Base habitual: ${Math.round(bp.baseMasterLimit).toLocaleString('es-CO')}
                              </Text>
                            )}
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

                        {habitSettings.isGloballyEnabled && isCategoryActive(bp.categoryId) && bp.hasDirectBudget && bp.budget && isParentMatching && (
                          <IconButton
                            icon="lightning-bolt-outline"
                            size={18}
                            iconColor={theme.colors.primary}
                            style={{ margin: 0, padding: 0 }}
                            accessibilityLabel="Convertir en hábito atómico"
                            onPress={() => {
                              setSelectedAtomicBudget({
                                budgetId: bp.budget!.id,
                                categoryId: bp.categoryId,
                                categoryName: bp.name,
                                monthlyLimit: bp.amountLimit,
                              });
                              setAtomicModalVisible(true);
                            }}
                          />
                        )}
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

                    {/* Footer de remanente y Safe-to-Spend */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      {catPacing ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <MaterialCommunityIcons name="lightning-bolt" size={13} color={theme.colors.primary} />
                          <Text style={[theme.typography.caption, { fontWeight: '600', color: theme.colors.primary, fontSize: 11 }]}>
                            Safe-to-Spend: ${Math.round(catPacing.dailySafeToSpend).toLocaleString('es-CO')}/d
                          </Text>
                        </View>
                      ) : <View />}

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
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                <Text style={[theme.typography.caption, { fontWeight: '600', color: theme.colors.onSurface }]}>
                                  {child.name} ({child.percentage}%)
                                </Text>
                                {child.rolloverAmount !== undefined && child.rolloverAmount !== 0 && (
                                  <View style={{
                                    backgroundColor: child.rolloverAmount > 0 ? '#05966915' : '#DC262615',
                                    paddingHorizontal: 5,
                                    paddingVertical: 1,
                                    borderRadius: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 2
                                  }}>
                                    <MaterialCommunityIcons
                                      name="swap-horizontal-bold"
                                      size={10}
                                      color={child.rolloverAmount > 0 ? '#059669' : '#DC2626'}
                                    />
                                    <Text style={{
                                      fontSize: 8,
                                      fontWeight: '700',
                                      color: child.rolloverAmount > 0 ? '#059669' : '#DC2626'
                                    }}>
                                      {child.rolloverAmount > 0
                                        ? `+${Math.round(child.rolloverAmount).toLocaleString('es-CO')}`
                                        : `${Math.round(child.rolloverAmount).toLocaleString('es-CO')}`}
                                    </Text>
                                  </View>
                                )}
                                {child.isOverride && (
                                  <View style={{
                                    backgroundColor: '#7C3AED18',
                                    paddingHorizontal: 5,
                                    paddingVertical: 1,
                                    borderRadius: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 2
                                  }}>
                                    <MaterialCommunityIcons
                                      name="star"
                                      size={10}
                                      color="#7C3AED"
                                    />
                                    <Text style={{
                                      fontSize: 8,
                                      fontWeight: '700',
                                      color: '#7C3AED'
                                    }}>
                                      {child.overrideReason ? child.overrideReason : 'Puntual'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
                                  $ {Math.round(child.spent).toLocaleString('es-CO')}
                                </Text>
                                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 10 }]}>
                                  de $ {Math.round(child.amountLimit).toLocaleString('es-CO')}
                                </Text>
                                {habitSettings.isGloballyEnabled && isCategoryActive(child.categoryId) && (
                                  <IconButton
                                    icon="lightning-bolt-outline"
                                    size={14}
                                    iconColor={theme.colors.primary}
                                    style={{ margin: 0, padding: 0 }}
                                    accessibilityLabel="Convertir en hábito atómico"
                                    onPress={() => {
                                      setSelectedAtomicBudget({
                                        budgetId: child.budget.id,
                                        categoryId: child.categoryId,
                                        categoryName: child.name,
                                        monthlyLimit: child.amountLimit,
                                      });
                                      setAtomicModalVisible(true);
                                    }}
                                  />
                                )}
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

      {/* ─── MODAL: CONVERTIR PRESUPUESTO EN HÁBITO ATÓMICO ───── */}
      {selectedAtomicBudget && (
        <CreateAtomicHabitModal
          visible={atomicModalVisible}
          budgetId={selectedAtomicBudget.budgetId}
          categoryId={selectedAtomicBudget.categoryId}
          categoryName={selectedAtomicBudget.categoryName}
          monthlyLimit={selectedAtomicBudget.monthlyLimit}
          onDismiss={() => {
            setAtomicModalVisible(false);
            setSelectedAtomicBudget(null);
          }}
          onHabitCreated={(habit) => {
            setAtomicModalVisible(false);
            setSelectedAtomicBudget(null);
            hapticSuccess();
            AppAlert.alert(
              '¡Hábito Creado!',
              `Se configuró "${habit.title}" con Safe-to-Spend y micro-reglas de comportamiento.`
            );
          }}
        />
      )}
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
