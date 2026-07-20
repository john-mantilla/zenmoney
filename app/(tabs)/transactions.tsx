/**
 * ZenMoney — Historial Completo de Movimientos
 *
 * Muestra el listado cronológico de transacciones del grupo familiar con
 * buscador en tiempo real, filtros por cuenta, visualización de categorías
 * de dos niveles y acceso a la edición de registros.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, ScrollView, Platform } from 'react-native';
import { Text, Searchbar, Button, Surface, ActivityIndicator, Chip, FAB } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { TransactionCard, EmptyState, AmountDisplay, NetworkStatusBar } from '@/src/presentation/components';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Account } from '@/src/domain/entities/Account';
import { Category } from '@/src/domain/entities/Category';
import { useRouter, useFocusEffect } from 'expo-router';

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  // Estados de datos
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Estados de control
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Repositorios
  const transactionRepo = new HybridTransactionRepository();
  const accountRepo = new HybridAccountRepository();
  const categoryRepo = new HybridCategoryRepository();

  const lastLoadRef = useRef<number>(0);

  const loadData = async (force = false) => {
    if (!force && Date.now() - lastLoadRef.current < 5000) {
      return;
    }
    lastLoadRef.current = Date.now();
    try {
      const loadedAccs = await accountRepo.getAll();
      setAccounts(loadedAccs);

      const loadedCats = await categoryRepo.getAll(true);
      setCategories(loadedCats);

      const loadedTxs = await transactionRepo.getAll({ status: 'confirmed' });
      setTransactions(loadedTxs);
      setFilteredTransactions(loadedTxs);
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
    }, [])
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
  }, [searchQuery, selectedAccountId, transactions]);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NetworkStatusBar />
      {/* Barra de Búsqueda */}
      <Surface style={styles.filterHeader} elevation={1}>
        <Searchbar
          placeholder="Buscar descripción o comercio..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchBar, { backgroundColor: theme.colors.background }]}
          inputStyle={theme.typography.body}
        />
        
        {/* Filtros horizontales por cuenta */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <Chip
            selected={selectedAccountId === null}
            onPress={() => setSelectedAccountId(null)}
            style={styles.chip}
          >
            Todas
          </Chip>
          {accounts.filter(a => a.isActive).map(acc => (
            <Chip
              key={acc.id}
              selected={selectedAccountId === acc.id}
              onPress={() => setSelectedAccountId(acc.id)}
              style={styles.chip}
            >
              {acc.name}
            </Chip>
          ))}
        </ScrollView>
      </Surface>

      {/* Listado de movimientos */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={item => item.id}
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

      {/* Barra de totales al final de la pantalla */}
      {filteredTransactions.length > 0 && (
        <Surface style={[styles.summaryFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]} elevation={2}>
          <View style={styles.summaryCol}>
            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Ingresos</Text>
            <AmountDisplay amount={getFilteredSums().income} size="sm" type="income" />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Gastos</Text>
            <AmountDisplay amount={getFilteredSums().expense} size="sm" type="expense" />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Neto</Text>
            <AmountDisplay
              amount={getFilteredSums().net}
              size="sm"
              type={getFilteredSums().net >= 0 ? 'income' : 'expense'}
            />
          </View>
        </Surface>
      )}

      {/* Botón Flotante FAB para crear transacciones */}
      <FAB
        icon="plus"
        label="Gasto / Voz"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#FFFFFF"
        onPress={() => router.push('/transaction/new')}
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
    paddingBottom: 100, // Margen extra para que el último item no quede tapado por la barra de totales
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
    bottom: 80,
    borderRadius: 16,
  },
});
