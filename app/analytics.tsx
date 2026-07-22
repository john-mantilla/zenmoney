import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import { TrendChart, ExpenseDonut } from '@/src/presentation/components';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { TrendAnalysisUseCase, TrendDataPoint } from '@/src/domain/usecases/TrendAnalysisUseCase';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AnalyticsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedYear, selectedMonth } = useDateStore();

  const [isLoading, setIsLoading] = useState(true);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const transactionRepo = new HybridTransactionRepository();
        const budgetRepo = new HybridBudgetRepository();
        const categoryRepo = new HybridCategoryRepository();
        const trendUseCase = new TrendAnalysisUseCase(transactionRepo, budgetRepo);

        // 1. Cargar tendencias
        const trend = await trendUseCase.execute();
        setTrendData(trend);

        // 2. Cargar TODAS las transacciones del mes (no solo 3)
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const monthStr = String(selectedMonth).padStart(2, '0');
        const startDate = `${selectedYear}-${monthStr}-01`;
        const endDate = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
        
        const txs = await transactionRepo.getAll({
          status: 'confirmed',
          startDate,
          endDate
        });
        setMonthTransactions(txs);

        // 3. Cargar categorías
        const cats = await categoryRepo.getAll(true);
        setCategories(cats);
        
      } catch (err) {
        console.error('[Analytics Error]', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedYear, selectedMonth]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
        <IconButton icon="close" size={24} onPress={() => router.back()} />
        <Text style={[theme.typography.h2, { fontWeight: 'bold' }]}>Análisis Visual</Text>
        <View style={{ width: 48 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[theme.typography.bodySmall, { marginTop: 16 }]}>Generando reportes...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TrendChart data={trendData} />
          
          <ExpenseDonut 
            expenses={monthTransactions}
            categories={categories}
            monthLabel={new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
