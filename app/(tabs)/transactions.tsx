/**
 * ZenMoney — Historial Completo de Movimientos
 *
 * Muestra el listado cronológico de transacciones del grupo familiar con
 * buscador en tiempo real, filtros por cuenta, visualización de categorías
 * de dos niveles y acceso a la edición de registros.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, SectionList, RefreshControl, Pressable, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { Text, Searchbar, Button, Surface, ActivityIndicator, Chip, FAB, SegmentedButtons, Portal, Dialog } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { TransactionCard, EmptyState, AmountDisplay, NetworkStatusBar } from '@/src/presentation/components';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Account } from '@/src/domain/entities/Account';
import { Category } from '@/src/domain/entities/Category';
import { SupabaseUserProfileRepository } from '@/src/data/repositories/SupabaseUserProfileRepository';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const { selectedYear, selectedMonth } = useDateStore();

  // Estados de datos
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Estados de control
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  useEffect(() => {
    if (params.accountId) {
      setSelectedAccountId(params.accountId);
    }
  }, [params.accountId]);
  const [viewMode, setViewMode] = useState<'date' | 'category'>('date');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  // Repositorios
  const transactionRepo = new HybridTransactionRepository();
  const accountRepo = new HybridAccountRepository();
  const categoryRepo = new HybridCategoryRepository();

  const lastLoadRef = useRef<number>(0);
  const lastLoadedMonthRef = useRef<number | null>(null);
  const lastLoadedYearRef = useRef<number | null>(null);

  const loadData = async (force = false) => {
    const isNewTimeframe = selectedMonth !== lastLoadedMonthRef.current || selectedYear !== lastLoadedYearRef.current;
    
    if (!force && !isNewTimeframe && Date.now() - lastLoadRef.current < 5000) {
      return;
    }
    lastLoadRef.current = Date.now();
    lastLoadedMonthRef.current = selectedMonth;
    lastLoadedYearRef.current = selectedYear;
    try {
      const loadedAccs = await accountRepo.getAll();
      setAccounts(loadedAccs);

      const loadedCats = await categoryRepo.getAll(true);
      setCategories(loadedCats);

      // Cargar familiares
      const store = require('@/src/infrastructure/auth/authStore');
      const { userProfile, familyGroup } = store.useAuthStore.getState();
      if (userProfile && familyGroup) {
        setCurrentUserId(userProfile.id);
        try {
          const userRepo = new SupabaseUserProfileRepository();
          const profiles = await userRepo.getByFamilyGroup(familyGroup.id);
          const membersMap: Record<string, string> = {};
          profiles.forEach(p => {
            const name = p.displayName || p.email || '?';
            const parts = name.trim().split(' ');
            let initials = name.substring(0, 2).toUpperCase();
            if (parts.length >= 2) {
              initials = (parts[0][0] + parts[1][0]).toUpperCase();
            }
            membersMap[p.id] = initials;
          });
          setFamilyMembers(membersMap);
        } catch (e) {
          console.warn('[Transactions] Error loading family members', e);
        }
      }

      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthStr = String(selectedMonth).padStart(2, '0');
      const startDate = `${selectedYear}-${monthStr}-01`;
      const endDate = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const loadedTxs = await transactionRepo.getAll({ 
        startDate, 
        endDate,
        status: 'confirmed'
      });
      setTransactions(loadedTxs);
    } catch (err) {
      console.error('[Transactions Load Error]:', err);
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

  // Filtrado reactivo en memoria
  useEffect(() => {
    let result = transactions;

    // Ocultar transacciones privadas de otros miembros de la familia del listado visual
    try {
      const store = require('@/src/infrastructure/auth/authStore');
      const currentUserId = store.useAuthStore.getState().userProfile?.id;
      if (currentUserId) {
        result = result.filter(tx => !tx.isPrivate || tx.createdByUserId === currentUserId);
      }
    } catch (e) {
      console.warn('[Transactions Filter Error]:', e);
    }

    // Filtro por cuenta
    if (selectedAccountId) {
      result = result.filter(
        tx => tx.accountId === selectedAccountId || tx.transferToAccountId === selectedAccountId
      );
    }

    // Filtro por integrante familiar
    if (selectedMemberId) {
      result = result.filter(tx => tx.createdByUserId === selectedMemberId);
    }

    // Filtro por tipo de movimiento (Ingresos / Gastos / Transferencias)
    if (selectedType !== 'all') {
      result = result.filter(tx => tx.type === selectedType);
    }

    // Filtro por buscador (descripción o comercio)
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        tx => 
          (tx.description && tx.description.toLowerCase().includes(q)) ||
          (tx.merchantName && tx.merchantName.toLowerCase().includes(q))
      );
    }

    setFilteredTransactions(result);
  }, [searchQuery, selectedAccountId, selectedMemberId, selectedType, transactions]);

  const getFilteredSums = () => {
    let incomeSum = 0;
    let expenseSum = 0;

    for (const tx of filteredTransactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        incomeSum += amount;
      } else if (tx.type === 'expense') {
        expenseSum += amount;
      } else if (tx.type === 'transfer') {
        if (selectedAccountId) {
          if (tx.transferToAccountId === selectedAccountId) {
            incomeSum += amount;
          } else if (tx.accountId === selectedAccountId) {
            expenseSum += amount;
          }
        }
      }
    }

    return {
      income: incomeSum,
      expense: expenseSum,
      net: incomeSum - expenseSum,
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const toggleDateCollapse = (dateId: string) => {
    setCollapsedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateId)) newSet.delete(dateId);
      else newSet.add(dateId);
      return newSet;
    });
  };

  const formatDateTitle = (dateString: string) => {
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getGroupedTransactionsByDate = () => {
    const grouped = new Map<string, { id: string; title: string; data: Transaction[]; total: number }>();
    
    for (const tx of filteredTransactions) {
      const dateId = tx.transactionDate;
      
      if (!grouped.has(dateId)) {
        const title = formatDateTitle(dateId);
        grouped.set(dateId, { id: dateId, title, data: [], total: 0 });
      }

      const group = grouped.get(dateId)!;
      
      if (!collapsedDates.has(dateId)) {
        group.data.push(tx);
      }
      
      const amount = Number(tx.amount);
      if (tx.type === 'income') group.total += amount;
      else if (tx.type === 'expense') group.total -= amount;
    }

    return Array.from(grouped.values()).sort((a, b) => b.id.localeCompare(a.id));
  };

  const getGroupedTransactions = () => {
    const grouped = new Map<string, { id: string; title: string; data: Transaction[]; total: number }>();
    
    for (const tx of filteredTransactions) {
      let catId = tx.categoryId;
      let parentCatId = catId;
      
      if (tx.type === 'transfer' && !catId) {
        parentCatId = 'transfer_system_cat';
      } else if (!catId) {
        parentCatId = 'unclassified_system_cat';
      } else {
        const cat = categories.find(c => c.id === catId);
        if (cat?.parentCategoryId) {
          parentCatId = cat.parentCategoryId;
        }
      }

      if (!grouped.has(parentCatId!)) {
        let catName = 'Sin clasificar';
        if (parentCatId === 'transfer_system_cat') {
          catName = 'Transferencias';
        } else if (parentCatId === 'unclassified_system_cat') {
          catName = 'Sin clasificar';
        } else {
          const parentCat = categories.find(c => c.id === parentCatId);
          catName = parentCat ? parentCat.name : 'Desconocida';
        }
        grouped.set(parentCatId!, { id: parentCatId!, title: catName, data: [], total: 0 });
      }

      const group = grouped.get(parentCatId!)!;
      
      if (!collapsedCategories.has(parentCatId!)) {
        group.data.push(tx);
      }
      
      const amount = Number(tx.amount);
      if (tx.type === 'income') group.total += amount;
      else if (tx.type === 'expense') group.total -= amount;
    }

    return Array.from(grouped.values()).sort((a, b) => a.title.localeCompare(b.title));
  };

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // ─── HELPER DE CATEGORÍAS DE 2 NIVELES ────────────────────────────────

  const getCategoryDisplayInfo = (categoryId: string | null) => {
    const defaultVal = { name: 'Sin clasificar', icon: 'help-circle', color: '#9E9E9E' };
    if (!categoryId) return defaultVal;

    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return defaultVal;

    // Si tiene categoría padre, construimos la visualización de 2 niveles: "Padre • Hijo"
    if (cat.parentCategoryId) {
      const parent = categories.find(c => c.id === cat.parentCategoryId);
      if (parent) {
        return {
          name: `${parent.name} • ${cat.name}`,
          icon: cat.icon || parent.icon,
          color: parent.color,
        };
      }
    }

    return {
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    };
  };

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || 'Cuenta';

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const activeFiltersCount = (selectedAccountId ? 1 : 0) + (selectedMemberId ? 1 : 0) + (selectedType !== 'all' ? 1 : 0) + (viewMode !== 'date' ? 1 : 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NetworkStatusBar />
      
      {/* ─── OPICÓN 1: BARRA COMPACTA DE BÚSQUEDA Y BOTÓN DE FILTROS ───────── */}
      <Surface style={[styles.filterHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline + '20' }]} elevation={1}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Searchbar
            placeholder="Buscar..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={[styles.searchBar, { flex: 1, backgroundColor: theme.colors.surfaceVariant, height: 42 }]}
            inputStyle={[theme.typography.body, { fontSize: 13, minHeight: 0 }]}
          />

          <Button
            mode={activeFiltersCount > 0 ? 'contained' : 'outlined'}
            icon="tune-variant"
            onPress={() => setIsFilterModalOpen(true)}
            style={{ borderRadius: 12, height: 42, justifyContent: 'center' }}
            contentStyle={{ height: 42, paddingHorizontal: 4 }}
            labelStyle={{ fontSize: 12, fontWeight: '700' }}
          >
            {activeFiltersCount > 0 ? `Filtros (${activeFiltersCount})` : 'Filtros'}
          </Button>
        </View>

        {/* Fila delgada con chips de filtros activos si existe alguno */}
        {activeFiltersCount > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            {selectedType !== 'all' && (
              <Chip
                compact
                onClose={() => setSelectedType('all')}
                style={{ backgroundColor: selectedType === 'income' ? '#05966920' : selectedType === 'expense' ? '#DC262620' : '#2563EB20' }}
                textStyle={{ fontSize: 11, color: selectedType === 'income' ? '#059669' : selectedType === 'expense' ? '#DC2626' : '#2563EB', fontWeight: '700' }}
              >
                {selectedType === 'income' ? '🟢 Solo Ingresos' : selectedType === 'expense' ? '🔴 Solo Gastos' : '🔵 Transferencias'}
              </Chip>
            )}
            {selectedAccountId && (
              <Chip
                compact
                onClose={() => setSelectedAccountId(null)}
                style={{ backgroundColor: theme.colors.primaryContainer + '40' }}
                textStyle={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}
              >
                {accounts.find(a => a.id === selectedAccountId)?.name || 'Cuenta'}
              </Chip>
            )}
            {selectedMemberId && (
              <Chip
                compact
                onClose={() => setSelectedMemberId(null)}
                style={{ backgroundColor: theme.colors.primaryContainer + '40' }}
                textStyle={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}
              >
                {selectedMemberId === currentUserId ? '👤 Tú' : `👤 ${familyMembers[selectedMemberId] || 'Miembro'}`}
              </Chip>
            )}
            {viewMode === 'category' && (
              <Chip
                compact
                onClose={() => setViewMode('date')}
                style={{ backgroundColor: theme.colors.primaryContainer + '40' }}
                textStyle={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}
              >
                Por Categoría
              </Chip>
            )}
            <Button
              compact
              mode="text"
              onPress={() => {
                setSelectedAccountId(null);
                setSelectedMemberId(null);
                setSelectedType('all');
                setViewMode('date');
              }}
              labelStyle={{ fontSize: 11, color: theme.colors.error }}
            >
              Limpiar
            </Button>
          </ScrollView>
        )}
      </Surface>

      {/* Listado de movimientos */}
      {viewMode === 'date' ? (
        <SectionList
          sections={getGroupedTransactionsByDate()}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section: { id, title, total } }) => (
            <Pressable onPress={() => toggleDateCollapse(id)}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons 
                    name={collapsedDates.has(id) ? 'chevron-down' : 'chevron-up'} 
                    size={20} 
                    color={theme.colors.onSurfaceVariant} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurfaceVariant, textTransform: 'capitalize' }]}>{title}</Text>
                </View>
                <AmountDisplay amount={total} size="sm" type={total >= 0 ? 'income' : 'expense'} />
              </View>
            </Pressable>
          )}
          renderItem={({ item }) => {
            const catInfo = getCategoryDisplayInfo(item.categoryId);
            const accName = getAccountName(item.accountId);
            
            return (
              <TransactionCard
                transaction={item}
                categoryName={catInfo.name}
                categoryIcon={catInfo.icon}
                categoryColor={catInfo.color}
                accountName={accName}
                authorInitials={item.createdByUserId !== currentUserId ? familyMembers[item.createdByUserId] : null}
                onPress={() => router.push(`/transaction/new?id=${item.id}`)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cash-register"
              title="Sin resultados"
              description="No encontramos ningún movimiento que coincida con tus filtros."
              actionLabel="Limpiar Filtros"
              onAction={() => {
                setSearchQuery('');
                setSelectedAccountId(null);
              }}
            />
          }
        />
      ) : (
        <SectionList
          sections={getGroupedTransactions()}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section: { id, title, total } }) => (
            <Pressable onPress={() => toggleCategoryCollapse(id)}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons 
                    name={collapsedCategories.has(id) ? 'chevron-down' : 'chevron-up'} 
                    size={20} 
                    color={theme.colors.onSurfaceVariant} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
                </View>
                <AmountDisplay amount={total} size="sm" type={total >= 0 ? 'income' : 'expense'} />
              </View>
            </Pressable>
          )}
          renderItem={({ item }) => {
            const catInfo = getCategoryDisplayInfo(item.categoryId);
            const accName = getAccountName(item.accountId);
            
            return (
              <TransactionCard
                transaction={item}
                categoryName={catInfo.name}
                categoryIcon={catInfo.icon}
                categoryColor={catInfo.color}
                accountName={accName}
                authorInitials={item.createdByUserId !== currentUserId ? familyMembers[item.createdByUserId] : null}
                onPress={() => router.push(`/transaction/new?id=${item.id}`)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cash-register"
              title="Sin resultados"
              description="No encontramos ningún movimiento que coincida con tus filtros."
              actionLabel="Limpiar Filtros"
              onAction={() => {
                setSearchQuery('');
                setSelectedAccountId(null);
              }}
            />
          }
        />
      )}

      {/* Barra de totales interactivos al pie de la pantalla (Taps para filtrar) */}
      <Surface style={[styles.summaryFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]} elevation={2}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setSelectedType(selectedType === 'income' ? 'all' : 'income')}
          style={[
            styles.summaryCol,
            {
              backgroundColor: selectedType === 'income' ? '#05966915' : 'transparent',
              borderRadius: 8,
              paddingVertical: 4,
            }
          ]}
        >
          <Text style={[theme.typography.caption, { color: selectedType === 'income' ? '#059669' : theme.customColors.textSecondary, fontWeight: selectedType === 'income' ? '800' : '500' }]}>
            Ingresos {selectedType === 'income' ? '✓' : ''}
          </Text>
          <AmountDisplay amount={getFilteredSums().income} size="sm" type="income" />
        </TouchableOpacity>

        <View style={styles.summaryDivider} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setSelectedType(selectedType === 'expense' ? 'all' : 'expense')}
          style={[
            styles.summaryCol,
            {
              backgroundColor: selectedType === 'expense' ? '#DC262615' : 'transparent',
              borderRadius: 8,
              paddingVertical: 4,
            }
          ]}
        >
          <Text style={[theme.typography.caption, { color: selectedType === 'expense' ? '#DC2626' : theme.customColors.textSecondary, fontWeight: selectedType === 'expense' ? '800' : '500' }]}>
            Gastos {selectedType === 'expense' ? '✓' : ''}
          </Text>
          <AmountDisplay amount={getFilteredSums().expense} size="sm" type="expense" />
        </TouchableOpacity>

        <View style={styles.summaryDivider} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setSelectedType('all')}
          style={[
            styles.summaryCol,
            {
              backgroundColor: selectedType === 'all' ? theme.colors.primaryContainer + '30' : 'transparent',
              borderRadius: 8,
              paddingVertical: 4,
            }
          ]}
        >
          <Text style={[theme.typography.caption, { color: selectedType === 'all' ? theme.colors.primary : theme.customColors.textSecondary, fontWeight: selectedType === 'all' ? '800' : '500' }]}>
            Neto
          </Text>
          <AmountDisplay
            amount={getFilteredSums().net}
            size="sm"
            type={getFilteredSums().net >= 0 ? 'income' : 'expense'}
          />
        </TouchableOpacity>
      </Surface>

      {/* FAB Flotante para crear movimiento rápido */}
      <FAB
        icon="plus"
        label="Gasto / Voz"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#FFFFFF"
        onPress={() => router.push('/transaction/new')}
      />

      {/* ─── PORTAL: DIÁLOGO DE FILTROS ────────────────────────────────────── */}
      <Portal>
        <Dialog
          visible={isFilterModalOpen}
          onDismiss={() => setIsFilterModalOpen(false)}
          style={{ borderRadius: 20, maxHeight: '85%' }}
        >
          <Dialog.Title style={{ fontWeight: '700' }}>Filtros de Movimientos</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
              
              {/* 0. Tipo de Movimiento */}
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.customColors.textSecondary, marginBottom: 8 }]}>
                TIPO DE MOVIMIENTO
              </Text>
              <SegmentedButtons
                value={selectedType}
                onValueChange={(val) => setSelectedType(val as any)}
                buttons={[
                  { value: 'all', label: 'Todos', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                  { value: 'income', label: 'Ingresos', icon: 'arrow-down-circle', checkedColor: '#059669', uncheckedColor: theme.colors.onSurface },
                  { value: 'expense', label: 'Gastos', icon: 'arrow-up-circle', checkedColor: '#DC2626', uncheckedColor: theme.colors.onSurface },
                  { value: 'transfer', label: 'Transfer.', icon: 'swap-horizontal', checkedColor: '#2563EB', uncheckedColor: theme.colors.onSurface },
                ]}
                style={{ marginBottom: 20 }}
              />

              {/* 1. Modo de Agrupamiento */}
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.customColors.textSecondary, marginBottom: 8 }]}>
                AGRUPAR MOVIMIENTOS
              </Text>
              <SegmentedButtons
                value={viewMode}
                onValueChange={(val) => setViewMode(val as 'date' | 'category')}
                buttons={[
                  { value: 'date', label: 'Por Fecha', icon: 'calendar-clock', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                  { value: 'category', label: 'Por Categoría', icon: 'shape-outline', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                ]}
                style={{ marginBottom: 20 }}
              />

              {/* 2. Filtrar por Cuenta */}
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.customColors.textSecondary, marginBottom: 8 }]}>
                FILTRAR POR CUENTA
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 6 }}>
                <Chip
                  selected={selectedAccountId === null}
                  onPress={() => setSelectedAccountId(null)}
                  style={{ borderRadius: 12 }}
                >
                  Todas
                </Chip>
                {accounts.filter(a => a.isActive).map(acc => (
                  <Chip
                    key={acc.id}
                    selected={selectedAccountId === acc.id}
                    onPress={() => setSelectedAccountId(acc.id)}
                    style={{ borderRadius: 12 }}
                  >
                    {acc.name}
                  </Chip>
                ))}
              </ScrollView>

              {/* 3. Filtrar por Miembro Familiar */}
              {Object.keys(familyMembers).length > 0 && (
                <>
                  <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.customColors.textSecondary, marginBottom: 8 }]}>
                    FILTRAR POR MIEMBRO FAMILIAR
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
                    <Chip
                      selected={selectedMemberId === null}
                      onPress={() => setSelectedMemberId(null)}
                      style={{ borderRadius: 12 }}
                    >
                      👥 Todos
                    </Chip>
                    {Object.entries(familyMembers).map(([id, initials]) => (
                      <Chip
                        key={id}
                        selected={selectedMemberId === id}
                        onPress={() => setSelectedMemberId(id)}
                        style={{ borderRadius: 12 }}
                      >
                        👤 {id === currentUserId ? 'Tú' : initials}
                      </Chip>
                    ))}
                  </ScrollView>
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>

          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Button
              onPress={() => {
                setSelectedAccountId(null);
                setSelectedMemberId(null);
                setSelectedType('all');
                setViewMode('date');
              }}
              textColor={theme.colors.error}
            >
              Limpiar Todo
            </Button>
            <Button mode="contained" onPress={() => setIsFilterModalOpen(false)} style={{ borderRadius: 10 }}>
              Aplicar
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  searchBar: {
    elevation: 0,
    borderRadius: 8,
    height: 44,
  },
  chipsRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingBottom: 2,
  },
  chip: {
    marginRight: 6,
    height: 32,
  },
  listContent: {
    padding: 16,
    paddingBottom: 150, // Margen extra para que el último item no quede tapado por la barra de totales
  },
  viewToggleContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12, // Padding extra para iOS home bar
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 95,
    borderRadius: 16,
  },
});
