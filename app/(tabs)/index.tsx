/**
 * ZenMoney — Dashboard Principal Optimizado para Alto Volumen
 *
 * Muestra el balance general y liquidez en un formato de acordeones estructurados
 * y colapsables, ideal para usuarios con múltiples cuentas, tarjetas y créditos.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Platform } from 'react-native';
import { Text, FAB, Surface, ActivityIndicator, Button, List, IconButton, Card } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { BalanceCard, TransactionCard, EmptyState, AmountDisplay, NetworkStatusBar } from '@/src/presentation/components';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { GetFinancialSummary } from '@/src/domain/usecases/GetFinancialSummary';
import { CalculateAccountBalance } from '@/src/domain/usecases/CalculateAccountBalance';
import { DetectRegistrationGap } from '@/src/domain/usecases/DetectRegistrationGap';
import { CalculateRegistrationStreak } from '@/src/domain/usecases/CalculateRegistrationStreak';
import { RegistrationReminderService } from '@/src/infrastructure/services/RegistrationReminderService';
import { BillAlertService } from '@/src/infrastructure/services/BillAlertService';
import { Account } from '@/src/domain/entities/Account';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function DashboardScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Agrupaciones de cuentas
  const [liquidAccounts, setLiquidAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<Account[]>([]);
  const [loanAccounts, setLoanAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Saldos consolidados
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [pendingEmailInvoices, setPendingEmailInvoices] = useState(0);
  const [registrationStreak, setRegistrationStreak] = useState(0);
  const [registrationGapDays, setRegistrationGapDays] = useState<number | null>(null);

  // Estados de control de colapsables (Acordeones)
  const [liquidExpanded, setLiquidExpanded] = useState(true);
  const [creditExpanded, setCreditExpanded] = useState(true);
  const [loansExpanded, setLoansExpanded] = useState(false); // Colapsado por defecto

  const accountRepo = new HybridAccountRepository();
  const transactionRepo = new HybridTransactionRepository();
  const categoryRepo = new HybridCategoryRepository();
  const summaryUseCase = new GetFinancialSummary(transactionRepo);
  const balanceUseCase = new CalculateAccountBalance(transactionRepo);
  const gapUseCase = new DetectRegistrationGap();
  const streakUseCase = new CalculateRegistrationStreak();

  const lastLoadRef = useRef<number>(0);

  const loadData = async (force = false) => {
    if (!force && Date.now() - lastLoadRef.current < 5000) {
      return;
    }
    lastLoadRef.current = Date.now();
    try {
      const loadedAccounts = await accountRepo.getAll();
      
      // Calcular saldos dinámicos reales para cada cuenta en base a transacciones confirmadas
      const accountsWithRealBalances = await Promise.all(
        loadedAccounts.map(async (acc) => {
          const realBalance = await balanceUseCase.execute(acc);
          return {
            ...acc,
            initialBalance: realBalance,
          };
        })
      );

      const activeAccounts = accountsWithRealBalances.filter(acc => acc.isActive);
      setAllAccounts(activeAccounts);

      // 1. Clasificación en 3 pilares financieros
      // Cuentas líquidas disponibles
      const liquid = activeAccounts.filter(acc => ['cash', 'bank', 'investment'].includes(acc.type));
      // Tarjetas de crédito (deuda a corto plazo)
      const cards = activeAccounts.filter(acc => acc.type === 'credit_card');
      // Créditos y obligaciones (deuda a largo plazo: hipotecas, préstamos)
      const loans = activeAccounts.filter(acc => ['loan', 'mortgage'].includes(acc.type));
      
      setLiquidAccounts(liquid);
      setCreditCards(cards);
      setLoanAccounts(loans);

      // Calcular Liquidez Consolidada: Dinero Líquido - Deuda Tarjetas
      const liquidSum = liquid.reduce((sum, acc) => sum + Number(acc.initialBalance), 0);
      const cardsSum = cards.reduce((sum, acc) => sum + Math.abs(Number(acc.initialBalance)), 0);
      
      // Saldo consolidado diario: Disponible - Tarjeta
      setTotalBalance(liquidSum - cardsSum);

      // 2. Cargar categorías para mapping
      const loadedCategories = await categoryRepo.getAll(true);
      setCategories(loadedCategories);

      // 3. Cargar movimientos recientes (limitado a 10 y luego filtrado para evitar huecos en el dashboard)
      const loadedTransactions = await transactionRepo.getAll({ limit: 10, status: 'confirmed' });
      let filteredTxs = loadedTransactions;
      if (userProfile) {
        filteredTxs = loadedTransactions.filter(tx => !tx.isPrivate || tx.createdByUserId === userProfile.id);
      }
      setRecentTransactions(filteredTxs.slice(0, 3));

      // 3b. Facturas electrónicas recibidas por correo, aún sin confirmar como gasto
      const pendingEmailTx = await transactionRepo.getAll({ status: 'pending', inputMethod: 'email' });
      setPendingEmailInvoices(pendingEmailTx.length);

      // 3c. Racha de registro y detección de "vacío" — ambas sobre el historial PERSONAL
      // del usuario (no de toda la familia), ya que es una señal de hábito individual.
      if (userProfile) {
        const todayStr = new Date().toISOString().split('T')[0];
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const ownTx = (await transactionRepo.getAll({
          startDate: ninetyDaysAgo.toISOString().split('T')[0],
          endDate: todayStr,
          status: 'confirmed',
        })).filter(tx => tx.createdByUserId === userProfile.id);

        setRegistrationStreak(streakUseCase.execute(ownTx.map(tx => tx.transactionDate), todayStr));

        const gapResult = gapUseCase.execute(ownTx, todayStr);
        setRegistrationGapDays(gapResult.hasGap ? gapResult.daysSinceLastTransaction : null);

        RegistrationReminderService.schedule(gapResult.expectedGapDays).catch(() => {});
      }

      // 4. Calcular resumen financiero mensual
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const summary = await summaryUseCase.execute(startDate, endDate);
      setMonthlyIncome(summary.totalIncome);
      setMonthlyExpenses(summary.totalExpenses);

      // Programar o actualizar las alertas de facturas por vencer
      BillAlertService.scheduleBillAlerts().catch(() => {});
      
    } catch (err) {
      console.error('[Dashboard Load Error]:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Recargar datos automáticamente cuando la pestaña gana foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const getCategoryDetails = (categoryId: string | null) => {
    const defaultCat = { name: 'Sin clasificar', icon: 'help-circle', color: '#9E9E9E' };
    if (!categoryId) return defaultCat;
    const cat = categories.find(c => c.id === categoryId);
    return cat ? { name: cat.name, icon: cat.icon, color: cat.color } : defaultCat;
  };

  const getAccountName = (accountId: string) => {
    return allAccounts.find(a => a.id === accountId)?.name || 'Cuenta Desconocida';
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, theme.typography.bodySmall]}>Cargando tu resumen financiero...</Text>
      </View>
    );
  }

  // Cálculos acumulados de categorías de cuentas para mostrar en el header de los acordeones
  const totalLiquidSum = liquidAccounts.reduce((sum, acc) => sum + Number(acc.initialBalance), 0);
  const totalCardsSum = creditCards.reduce((sum, acc) => sum + Math.abs(Number(acc.initialBalance)), 0);
  const totalLoansSum = loanAccounts.reduce((sum, acc) => sum + Math.abs(Number(acc.initialBalance)), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NetworkStatusBar />
      {/* Cabecera del Dashboard con botón de Asistente IA */}
      <View style={[styles.dashboardHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]}>
        <View>
          <Text style={[theme.typography.h2, { fontWeight: 'bold' }]}>ZenMoney</Text>
          {registrationStreak > 0 && (
            <View style={styles.streakRow}>
              <MaterialCommunityIcons name="fire" size={14} color={theme.customColors.warning} />
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginLeft: 2 }]}>
                {registrationStreak === 1 ? '1 día seguido registrando' : `${registrationStreak} días seguidos registrando`}
              </Text>
            </View>
          )}
        </View>
        <IconButton
          icon="robot-happy-outline"
          iconColor={theme.colors.primary}
          size={24}
          onPress={() => router.push('/assistant')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        {/* Métrica principal: Disponible Real (Disponible - Tarjetas de crédito) */}
        <BalanceCard
          balance={totalBalance}
          income={monthlyIncome}
          expenses={monthlyExpenses}
          currency="COP"
          label="DISPONIBLE LÍQUIDO"
        />

        {/* Aviso de posible vacío en el registro: lleva más días de lo habitual sin anotar nada */}
        {registrationGapDays !== null && (
          <Card
            style={[styles.emailInboxCard, { backgroundColor: theme.customColors.dangerLight }]}
            onPress={() => router.push('/transaction/new')}
          >
            <Card.Content style={styles.emailInboxContent}>
              <MaterialCommunityIcons name="calendar-alert" size={28} color={theme.colors.error} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[theme.typography.body, { fontWeight: '600' }]}>
                  Llevas {registrationGapDays} días sin registrar nada
                </Text>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                  ¿Se te pasó algún gasto? Toca para registrarlo
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={theme.customColors.textSecondary} />
            </Card.Content>
          </Card>
        )}

        {/* Aviso de facturas electrónicas recibidas por correo, ya pagadas, esperando confirmación */}
        {pendingEmailInvoices > 0 && (
          <Card
            style={[styles.emailInboxCard, { backgroundColor: theme.customColors.warningLight }]}
            onPress={() => router.push('/email-inbox')}
          >
            <Card.Content style={styles.emailInboxContent}>
              <MaterialCommunityIcons name="email-fast-outline" size={28} color={theme.customColors.warning} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[theme.typography.body, { fontWeight: '600' }]}>
                  {pendingEmailInvoices === 1
                    ? 'Tienes 1 factura por confirmar'
                    : `Tienes ${pendingEmailInvoices} facturas por confirmar`}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                  Llegaron por correo — revísalas para registrarlas como gasto
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={theme.customColors.textSecondary} />
            </Card.Content>
          </Card>
        )}

        {/* ─── SECCIÓN ACORDEONES DE CUENTAS ───────────────────────────────── */}
        <View style={styles.accountsSection}>
          
          {/* 1. Dinero Líquido */}
          <List.Accordion
            title="Cuentas de Dinero"
            description={`${liquidAccounts.length} cuentas disponibles`}
            expanded={liquidExpanded}
            onPress={() => setLiquidExpanded(!liquidExpanded)}
            left={props => <List.Icon {...props} icon="wallet-outline" color={theme.colors.primary} />}
            right={() => (
              <AmountDisplay amount={totalLiquidSum} size="sm" type="neutral" style={styles.headerAmount} />
            )}
            style={[styles.accordionHeader, { backgroundColor: theme.colors.surface }]}
          >
            {liquidAccounts.map(account => (
              <List.Item
                key={account.id}
                title={account.name}
                description={account.type === 'cash' ? 'Efectivo' : 'Cuenta de ahorro/banco'}
                right={() => (
                  <AmountDisplay amount={account.initialBalance} size="sm" type="neutral" style={styles.itemAmount} />
                )}
                style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
              />
            ))}
          </List.Accordion>

          {/* 2. Tarjetas de Crédito */}
          {creditCards.length > 0 && (
            <List.Accordion
              title="Tarjetas de Crédito"
              description={`${creditCards.length} tarjetas activas`}
              expanded={creditExpanded}
              onPress={() => setCreditExpanded(!creditExpanded)}
              left={props => <List.Icon {...props} icon="credit-card-outline" color={theme.customColors.danger} />}
              right={() => (
                <AmountDisplay amount={totalCardsSum} size="sm" type="expense" style={styles.headerAmount} />
              )}
              style={[styles.accordionHeader, { backgroundColor: theme.colors.surface, marginTop: 8 }]}
            >
              {creditCards.map(account => (
                <List.Item
                  key={account.id}
                  title={account.name}
                  description="Deuda a corto plazo"
                  right={() => (
                    <AmountDisplay amount={account.initialBalance} size="sm" type="expense" style={styles.itemAmount} />
                  )}
                  style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                />
              ))}
            </List.Accordion>
          )}

          {/* 3. Créditos y Préstamos (Largo Plazo) */}
          {loanAccounts.length > 0 && (
            <List.Accordion
              title="Créditos y Préstamos"
              description={`${loanAccounts.length} obligaciones activas`}
              expanded={loansExpanded}
              onPress={() => setLoansExpanded(!loansExpanded)}
              left={props => <List.Icon {...props} icon="bank-transfer-out" color={theme.customColors.accent} />}
              right={() => (
                <AmountDisplay amount={totalLoansSum} size="sm" type="expense" style={styles.headerAmount} />
              )}
              style={[styles.accordionHeader, { backgroundColor: theme.colors.surface, marginTop: 8 }]}
            >
              {loanAccounts.map(account => (
                <List.Item
                  key={account.id}
                  title={account.name}
                  description={account.type === 'mortgage' ? 'Hipotecario' : 'Vehículo / Consumo'}
                  right={() => (
                    <AmountDisplay amount={account.initialBalance} size="sm" type="expense" style={styles.itemAmount} />
                  )}
                  style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                />
              ))}
            </List.Accordion>
          )}
        </View>

        {/* ─── MOVIMIENTOS RECIENTES (ÚLTIMOS 3) ───────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
            Movimientos Recientes
          </Text>
          <Button compact onPress={() => router.push('/transactions')} textColor={theme.colors.primary}>
            Ver más
          </Button>
        </View>

        {recentTransactions.length === 0 ? (
          <EmptyState
            icon="cash-register"
            title="Sin movimientos"
            description="Aún no has registrado transacciones este mes. ¡Prueba el asistente de voz!"
            actionLabel="Registrar Gasto"
            onAction={() => router.push('/transaction/new')}
          />
        ) : (
          <View style={styles.transactionsList}>
            {recentTransactions.map(tx => {
              const cat = getCategoryDetails(tx.categoryId);
              const accName = getAccountName(tx.accountId);
              return (
                <TransactionCard
                  key={tx.id}
                  transaction={tx}
                  categoryName={cat.name}
                  categoryIcon={cat.icon}
                  categoryColor={cat.color}
                  accountName={accName}
                  onPress={() => {}}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

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
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  emailInboxCard: {
    marginTop: 16,
    borderRadius: 12,
  },
  emailInboxContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountsSection: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  accordionHeader: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  accordionItem: {
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  headerAmount: {
    alignSelf: 'center',
    marginRight: 8,
    fontWeight: 'bold',
  },
  itemAmount: {
    alignSelf: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  transactionsList: {
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
});
