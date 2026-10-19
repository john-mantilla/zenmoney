/**
 * ZenMoney — Dashboard Principal Optimizado para Alto Volumen
 *
 * Muestra el balance general y liquidez en un formato de acordeones estructurados
 * y colapsables, ideal para usuarios con múltiples cuentas, tarjetas y créditos.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Platform, TouchableOpacity, Image } from 'react-native';
import { Text, FAB, Surface, ActivityIndicator, Button, List, IconButton, Card, Portal, Dialog, Snackbar } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import * as Haptics from 'expo-haptics';
import { BalanceCard, TransactionCard, EmptyState, AmountDisplay, NetworkStatusBar, ChallengeCard, ZenHabitsNudgeCard, DailySafeToSpendCard } from '@/src/presentation/components';
import { getAccountBrandInfo } from '@/src/presentation/theme/accountBrands';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { GetFinancialSummary } from '@/src/domain/usecases/GetFinancialSummary';
import { CalculateAccountBalance } from '@/src/domain/usecases/CalculateAccountBalance';
import { DetectRegistrationGap } from '@/src/domain/usecases/DetectRegistrationGap';
import { CalculateRegistrationStreak } from '@/src/domain/usecases/CalculateRegistrationStreak';
import { Evaluate7DayChallenge } from '@/src/domain/usecases/Evaluate7DayChallenge';
import { CalculateDailyPacing } from '@/src/domain/usecases/CalculateDailyPacing';
import { DailyPacing } from '@/src/domain/entities/AtomicHabit';
import { Budget } from '@/src/domain/entities/Budget';
import { useHabitSettingsStore } from '@/src/infrastructure/state/habitSettingsStore';
import { Challenge } from '@/src/domain/entities/Challenge';
import { HybridChallengeRepository } from '@/src/data/repositories/HybridChallengeRepository';
import { RegistrationReminderService } from '@/src/infrastructure/services/RegistrationReminderService';
import { BillAlertService } from '@/src/infrastructure/services/BillAlertService';
import { Account } from '@/src/domain/entities/Account';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { AnomalyDetectorService, SmartAlert } from '@/src/infrastructure/services/AnomalyDetectorService';
import { SupabaseUserProfileRepository } from '@/src/data/repositories/SupabaseUserProfileRepository';
import { FinancialHealthModal } from '@/src/presentation/components/FinancialHealthModal';
import { SyncService } from '@/src/infrastructure/services/SyncService';
import { isOnlineFast } from '@/src/infrastructure/utils/network';
import { useHabitStore } from '@/src/infrastructure/state/habitStore';
import { HabitPattern } from '@/src/domain/entities/HabitPattern';
import { EvaluateHabitNudge } from '@/src/domain/usecases/EvaluateHabitNudge';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function DashboardScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { userProfile } = useAuthStore();
  const { selectedYear, selectedMonth } = useDateStore();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Agrupaciones de cuentas
  const [liquidAccounts, setLiquidAccounts] = useState<Account[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<Account[]>([]);
  const [loanAccounts, setLoanAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Saldos consolidados
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [hasVoicePending, setHasVoicePending] = useState(false);
  const [registrationStreak, setRegistrationStreak] = useState(0);
  const [registrationGapDays, setRegistrationGapDays] = useState<number | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  
  // Alertas Inteligentes & Modal de Salud Financiera 50/30/20
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([]);
  const [healthModalVisible, setHealthModalVisible] = useState(false);
  const [activeHabitNudges, setActiveHabitNudges] = useState<HabitPattern[]>([]);
  const [dailyPacing, setDailyPacing] = useState<DailyPacing | null>(null);

  // Parámetros de Toast por voz
  const params = useLocalSearchParams<{
    voiceToast?: string;
    voiceAmount?: string;
    voiceCategory?: string;
    voiceTxId?: string;
    voiceToastPending?: string;
  }>();

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastTxId, setToastTxId] = useState<string | null>(null);

  useEffect(() => {
    if (params.voiceToast === 'true') {
      const amtNum = Number(params.voiceAmount || 0);
      const amtStr = amtNum > 0 ? `$${amtNum.toLocaleString('es-CO')}` : '';
      const catStr = params.voiceCategory || 'Gasto';
      setToastMessage(`✅ Registrado por voz: ${amtStr} en ${catStr}`);
      setToastTxId(params.voiceTxId || null);
      setToastVisible(true);
    } else if (params.voiceToastPending === 'true') {
      setToastMessage('⚠️ Guardado en "Por Confirmar" (Falta indicar el monto)');
      setToastTxId(params.voiceTxId || null);
      setToastVisible(true);
    }
  }, [params.voiceToast, params.voiceAmount, params.voiceCategory, params.voiceTxId, params.voiceToastPending]);

  // Estados de control de colapsables (Acordeones - Colapsados por defecto para una vista compacta)
  const [liquidExpanded, setLiquidExpanded] = useState(false);
  const [investmentsExpanded, setInvestmentsExpanded] = useState(false);
  const [creditExpanded, setCreditExpanded] = useState(false);
  const [loansExpanded, setLoansExpanded] = useState(false);
  const [selectedAccountForAction, setSelectedAccountForAction] = useState<Account | null>(null);

  // Estadísticas históricas de la cuenta seleccionada en el modal
  const [accountStats, setAccountStats] = useState<{
    totalIncome: number;
    totalExpenses: number;
    startDateStr: string | null;
    isLoading: boolean;
  }>({ totalIncome: 0, totalExpenses: 0, startDateStr: null, isLoading: false });

  useEffect(() => {
    if (!selectedAccountForAction) return;

    const calculateStats = async () => {
      setAccountStats(prev => ({ ...prev, isLoading: true }));
      try {
        const allTx = await transactionRepo.getAll({
          accountId: selectedAccountForAction.id,
          status: 'confirmed',
        });

        let income = 0;
        let expenses = 0;
        let earliestDate: string | null = selectedAccountForAction.createdAt ? selectedAccountForAction.createdAt.split('T')[0] : null;

        for (const tx of allTx) {
          const amt = Number(tx.amount) || 0;
          if (tx.type === 'income') {
            income += amt;
          } else if (tx.type === 'expense') {
            expenses += amt;
          }

          if (tx.transactionDate) {
            const txDate = tx.transactionDate.split('T')[0];
            if (!earliestDate || txDate < earliestDate) {
              earliestDate = txDate;
            }
          }
        }

        setAccountStats({
          totalIncome: income,
          totalExpenses: expenses,
          startDateStr: earliestDate,
          isLoading: false,
        });
      } catch (e) {
        console.error('[Account Stats Load Error]', e);
        setAccountStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    calculateStats();
  }, [selectedAccountForAction?.id]);

  const accountRepo = new HybridAccountRepository();
  const transactionRepo = new HybridTransactionRepository();
  const categoryRepo = new HybridCategoryRepository();
  const summaryUseCase = new GetFinancialSummary(transactionRepo);
  const balanceUseCase = new CalculateAccountBalance(transactionRepo);
  const gapUseCase = new DetectRegistrationGap();
  const streakUseCase = new CalculateRegistrationStreak();

  const lastLoadRef = useRef<number>(0);
  const lastLoadedMonthRef = useRef<number | null>(null);
  const lastLoadedYearRef = useRef<number | null>(null);

  const loadData = async (force = false) => {
    const isNewTimeframe = selectedMonth !== lastLoadedMonthRef.current || selectedYear !== lastLoadedYearRef.current;
    
    if (!force && !isNewTimeframe && Date.now() - lastLoadRef.current < 15000) {
      return;
    }
    lastLoadRef.current = Date.now();
    lastLoadedMonthRef.current = selectedMonth;
    lastLoadedYearRef.current = selectedYear;

    const executeFetch = async (preferCache: boolean) => {
      const loadedAccounts = await accountRepo.getAll(preferCache);
      
      // Calcular saldos dinámicos reales para cada cuenta en base a transacciones confirmadas
      const accountsWithRealBalances = await Promise.all(
        loadedAccounts.map(async (acc) => {
          const realBalance = await balanceUseCase.execute(acc, preferCache);
          return {
            ...acc,
            initialBalance: realBalance,
            currentBalance: realBalance,
          };
        })
      );

      if (!preferCache) {
        // Persistir saldos consolidados en SQLite para lecturas offline confiables
        accountsWithRealBalances.forEach((acc) => {
          accountRepo.updateBalance(acc.id, acc.currentBalance ?? acc.initialBalance).catch(() => {});
        });
      }

      const activeAccounts = accountsWithRealBalances.filter(acc => acc.isActive);
      setAllAccounts(activeAccounts);

      const userProfile = useAuthStore.getState().userProfile;
      const familyGroup = useAuthStore.getState().familyGroup;
      
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
          console.warn('[Dashboard] Error loading family members', e);
        }
      }

      // 1. Clasificación en 4 pilares financieros
      const liquid = activeAccounts.filter(acc => ['cash', 'bank'].includes(acc.type));
      const investments = activeAccounts.filter(acc => acc.type === 'investment');
      const cards = activeAccounts.filter(acc => acc.type === 'credit_card');
      const loans = activeAccounts.filter(acc => ['loan', 'mortgage'].includes(acc.type));
      
      setLiquidAccounts(liquid);
      setInvestmentAccounts(investments);
      setCreditCards(cards);
      setLoanAccounts(loans);

      const liquidSum = liquid.reduce((sum, acc) => sum + Number(acc.currentBalance ?? acc.initialBalance), 0);
      const cardsSum = cards.reduce((sum, acc) => sum + Math.abs(Number(acc.currentBalance ?? acc.initialBalance)), 0);
      setTotalBalance(liquidSum - cardsSum);

      // 2. Cargar categorías para mapping
      const loadedCategories = await categoryRepo.getAll(true, preferCache);
      setCategories(loadedCategories);

      // Calcular resumen financiero mensual y rango de fechas
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthStr = String(selectedMonth).padStart(2, '0');
      const startDate = `${selectedYear}-${monthStr}-01`;
      const endDate = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // 3. Cargar todos los movimientos confirmados del mes seleccionado
      const loadedTransactions = await transactionRepo.getAll({ 
        status: 'confirmed',
        startDate,
        endDate
      }, preferCache);
      let filteredTxs = loadedTransactions;
      if (userProfile) {
        filteredTxs = loadedTransactions.filter(tx => !tx.isPrivate || tx.createdByUserId === userProfile.id);
      }
      setMonthTransactions(filteredTxs);
      setRecentTransactions(filteredTxs.slice(0, 3));

      // 3b. Movimientos pendientes (correo, notas de voz del reloj sin monto, etc.)
      const pendingTxList = await transactionRepo.getAll({ status: 'pending' }, preferCache);
      setPendingTransactionsCount(pendingTxList.length);
      setHasVoicePending(pendingTxList.some(tx => tx.inputMethod === 'voice' || (tx.description && tx.description.startsWith('🎙️'))));

      // 3c. Racha de registro y detección de "vacío"
      if (userProfile) {
        const todayStr = new Date().toISOString().split('T')[0];
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const ownTx = (await transactionRepo.getAll({
          startDate: ninetyDaysAgo.toISOString().split('T')[0],
          endDate: todayStr,
          status: 'confirmed',
        }, preferCache)).filter(tx => tx.createdByUserId === userProfile.id);

        setRegistrationStreak(streakUseCase.execute(ownTx.map(tx => tx.transactionDate), todayStr));

        const gapResult = gapUseCase.execute(ownTx, todayStr);
        setRegistrationGapDays(gapResult.hasGap ? gapResult.daysSinceLastTransaction : null);

        const challengeRepo = new HybridChallengeRepository();
        const customChallenges = await challengeRepo.getAll();
        const activeCustom = customChallenges.find((c) => c.status === 'active');

        if (activeCustom) {
          setChallenge(activeCustom);
        } else {
          const challengeData = Evaluate7DayChallenge.execute(ownTx, todayStr, userProfile.id);
          setChallenge(challengeData);
        }

        RegistrationReminderService.scheduleInactivityReminder(2).catch(() => {});
        BillAlertService.scheduleBillAlerts().catch(() => {});
      }

      // 4. Calcular resumen financiero mensual directamente desde las transacciones del mes
      let incomeSum = 0;
      let expensesSum = 0;
      for (const tx of loadedTransactions) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') {
          incomeSum += amt;
        } else if (tx.type === 'expense') {
          expensesSum += amt;
        }
      }
      setMonthlyIncome(incomeSum);
      setMonthlyExpenses(expensesSum);

      // 5. Escanear Anomalías Financieras
      const anomalyService = new AnomalyDetectorService();
      const alerts = await anomalyService.scanForAnomalies(preferCache);
      setSmartAlerts(alerts);

      // 6. Evaluar ZenHabits (Recordatorios nocturnos 21:00 con Regla del Silencio)
      const habits = useHabitStore.getState().habits;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTxs = loadedTransactions.filter((tx) => tx.transactionDate === todayStr);

      const triggeredHabits: HabitPattern[] = [];
      for (const habit of habits) {
        if (!habit.isActive) continue;
        if (useHabitStore.getState().isDismissedToday(habit.id)) continue;

        const evalResult = EvaluateHabitNudge.execute(
          habit,
          todayTxs,
          new Date()
        );

        if (evalResult.shouldNudge) {
          triggeredHabits.push(habit);
        }
      }
      setActiveHabitNudges(triggeredHabits);

      // 7. Calcular Daily Safe-to-Spend Consolidado (Hábitos Atómicos)
      try {
        const budgetRepo = new HybridBudgetRepository();
        const allBudgets = await budgetRepo.getAll();
        const currentMonthBudgets = allBudgets.filter(
          (b) => b.year === selectedYear && b.month === selectedMonth
        );
        const totalBudgetLimit = currentMonthBudgets.reduce(
          (acc, b) => acc + (Number(b.amountLimit) || 0),
          0
        );

        if (totalBudgetLimit > 0) {
          const consolidatedBudget: Budget = {
            id: 'budget-consolidated',
            familyGroupId: 'family-1',
            categoryId: 'all',
            amountLimit: totalBudgetLimit,
            year: selectedYear,
            month: selectedMonth,
            scope: 'family',
            ownerUserId: null,
            createdAt: new Date().toISOString(),
          };

          const spentToday = todayTxs
            .filter((tx) => tx.type === 'expense')
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

          const pacing = CalculateDailyPacing.execute({
            budget: consolidatedBudget,
            monthlySpent: expensesSum,
            spentToday,
            currentDate: new Date(),
            settings: useHabitSettingsStore.getState().settings,
          });

          setDailyPacing(pacing);
        } else {
          setDailyPacing(null);
        }
      } catch (err) {
        console.warn('[Dashboard] Error calculando daily pacing:', err);
      }

      return activeAccounts;
    };

    // 1. CARGA INMEDIATA LOCAL-FIRST (Zero Latency)
    // Lee de la base de datos local SQLite en < 30ms para pintar el dashboard instantáneamente
    let hasLocalData = false;
    try {
      const localActive = await executeFetch(true);
      if (localActive && localActive.length > 0) {
        hasLocalData = true;
        setIsLoading(false);
      }
    } catch (localErr) {
      console.warn('[Dashboard Local Load Error]', localErr);
    }

    // Si no había datos locales (primera instalación en frío), mantener spinner
    if (!hasLocalData) {
      setIsLoading(true);
    }

    // 2. REVALIDACIÓN SILENCIOSA EN SEGUNDO PLANO (Stale-While-Revalidate)
    // Si el dispositivo está online, actualiza con la nube en background sin bloquear la pantalla
    try {
      const isOnline = await isOnlineFast();
      if (isOnline) {
        await executeFetch(false);
      }
    } catch (err) {
      console.error('[Dashboard Revalidation Error]:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Recargar datos automáticamente cuando la pestaña gana foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedYear, selectedMonth])
  );

  const onRefresh = () => {
    setRefreshing(true);
    SyncService.fullSync()
      .catch(() => {})
      .finally(() => {
        loadData(true);
      });
  };

  const getCategoryDetails = (categoryId: string | null) => {
    const defaultCat = { name: 'Sin clasificar', icon: 'help-circle', color: '#9E9E9E' };
    if (!categoryId) return defaultCat;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return defaultCat;

    if (cat.parentCategoryId) {
      const parent = categories.find(c => c.id === cat.parentCategoryId);
      if (parent) {
        const isGenericIcon = !cat.icon || ['tag', 'tag-outline', 'label', 'label-outline', 'bookmark-outline', 'shape-outline'].includes(cat.icon);
        const finalIcon = isGenericIcon ? (parent.icon || 'tag-outline') : cat.icon;

        return {
          name: `${parent.name} • ${cat.name}`,
          icon: finalIcon,
          color: parent.color || cat.color,
        };
      }
    }

    return { name: cat.name, icon: cat.icon || 'tag-outline', color: cat.color };
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
  const totalInvestmentsSum = investmentAccounts.reduce((sum, acc) => sum + Number(acc.initialBalance), 0);
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
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon="chart-pie"
            iconColor={theme.colors.primary}
            size={24}
            onPress={() => router.push('/analytics')}
          />
          <IconButton
            icon="robot-happy-outline"
            iconColor={theme.colors.primary}
            size={24}
            onPress={() => router.push('/assistant')}
          />
          <IconButton
            icon="trophy-outline"
            iconColor={theme.colors.primary}
            size={24}
            onPress={() => router.push('/coach')}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        {/* ZenHabits — Nudges y Rutinas Activas */}
        {activeHabitNudges.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            {activeHabitNudges.map((habit) => (
              <ZenHabitsNudgeCard
                key={habit.id}
                habit={habit}
                onRegistered={() => {
                  setActiveHabitNudges((prev) => prev.filter((h) => h.id !== habit.id));
                  onRefresh();
                }}
                onSkipped={() => {
                  setActiveHabitNudges((prev) => prev.filter((h) => h.id !== habit.id));
                }}
              />
            ))}
          </View>
        )}

        {/* Alertas Inteligentes con persistencia de descarte */}
        {smartAlerts.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            {smartAlerts.map((alert) => (
              <Surface key={alert.id} style={[styles.alertCard, { backgroundColor: theme.colors.surfaceVariant, marginBottom: 8 }]} elevation={1}>
                <View style={styles.alertHeader}>
                  <MaterialCommunityIcons
                    name={
                      alert.type === 'duplicate'
                        ? 'content-copy'
                        : alert.type === 'subscription'
                        ? 'calendar-sync'
                        : alert.type === 'habit'
                        ? 'repeat'
                        : 'alert-decagram'
                    }
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text style={[theme.typography.caption, { fontWeight: 'bold', color: theme.colors.primary, marginLeft: 8, flex: 1 }]}>
                    {alert.title || 'Alerta Inteligente'}
                  </Text>
                  <IconButton
                    icon="close"
                    size={18}
                    iconColor={theme.customColors.textSecondary}
                    onPress={async () => {
                      await AnomalyDetectorService.dismissAlert(alert.id);
                      setSmartAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                    }}
                    style={{ margin: 0 }}
                  />
                </View>

                {/* Formateador de texto con negritas */}
                <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurface, marginTop: 4, lineHeight: 20 }]}>
                  {alert.message.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                    i % 2 === 1 ? (
                      <Text key={i} style={{ fontWeight: 'bold' }}>
                        {part}
                      </Text>
                    ) : (
                      <Text key={i}>{part}</Text>
                    )
                  )}
                </Text>

                {/* Botones de Acción Rápida / Entendido */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, gap: 8 }}>
                  {/* Opción 1: Si es una alerta de tipo suscripción o recurrente, ofrecer Agendar Factura */}
                  {alert.actionRoute && (
                    <Button
                      mode="text"
                      compact
                      textColor={theme.colors.primary}
                      onPress={async () => {
                        await AnomalyDetectorService.dismissAlert(alert.id);
                        setSmartAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                        router.push(alert.actionRoute as any);
                      }}
                    >
                      {alert.actionLabel || 'Agendar Factura'}
                    </Button>
                  )}

                  {/* Opción 2: Activar Hábito (Disponible tanto para tipo 'habit' como para tipo 'subscription' con habitData) */}
                  {alert.habitData && (
                    <Button
                      mode={alert.type === 'habit' ? 'contained' : 'text'}
                      compact
                      buttonColor={alert.type === 'habit' ? theme.colors.primary : undefined}
                      textColor={alert.type === 'habit' ? '#FFFFFF' : theme.customColors.accent}
                      onPress={async () => {
                        useHabitStore.getState().addHabit(alert.habitData as any);
                        await AnomalyDetectorService.dismissAlert(alert.id);
                        setSmartAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                        onRefresh();
                      }}
                      style={{ borderRadius: 10 }}
                    >
                      Activar Hábito
                    </Button>
                  )}

                  {/* Opción 3: Entendido / Descartar */}
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={async () => {
                      await AnomalyDetectorService.dismissAlert(alert.id);
                      setSmartAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                    }}
                    style={{ borderRadius: 10 }}
                  >
                    Entendido
                  </Button>
                </View>
              </Surface>
            ))}
          </View>
        )}

        {/* Métrica principal: Disponible Real (Disponible - Tarjetas de crédito) */}
        <BalanceCard
          balance={totalBalance}
          income={monthlyIncome}
          expenses={monthlyExpenses}
          currency="COP"
          label="DISPONIBLE LÍQUIDO"
          onPressAnalysis={() => setHealthModalVisible(true)}
        />

        {/* ─── HÁBITOS ATÓMICOS: DAILY SAFE-TO-SPEND CARD ────────────────── */}
        {dailyPacing && (
          <DailySafeToSpendCard
            pacing={dailyPacing}
            categoryName="Presupuesto Mensual"
            onPressSettings={() => router.push('/(tabs)/settings')}
            onPressDetails={() => router.push('/(tabs)/budgets')}
          />
        )}

        {/* ─── SECCIÓN ACCIONES RÁPIDAS (Justo debajo de la tarjeta de balance) ── */}
        <View style={{ marginTop: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* 1. Escanear Recibo */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: '/transaction/new', params: { action: 'camera' } })}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.colors.outline + '25',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.primaryContainer, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="camera" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface, fontSize: 12 }]}>
                Escanear
              </Text>
            </TouchableOpacity>

            {/* 2. Dictar por Voz */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: '/transaction/new', params: { mode: 'ai', action: 'voice' } })}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.colors.outline + '25',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.primaryContainer, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="microphone" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface, fontSize: 12 }]}>
                Voz
              </Text>
            </TouchableOpacity>

            {/* 3. Transferir */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: '/transaction/new', params: { mode: 'manual', type: 'transfer' } })}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.colors.outline + '25',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.primaryContainer, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="swap-horizontal" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface, fontSize: 12 }]}>
                Transferir
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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

        {/* Aviso de movimientos pendientes esperando confirmación (Voz del reloj, facturas o notificaciones) */}
        {pendingTransactionsCount > 0 && (
          <Card
            style={[styles.emailInboxCard, { backgroundColor: theme.customColors.warningLight }]}
            onPress={() => router.push('/email-inbox')}
          >
            <Card.Content style={styles.emailInboxContent}>
              <MaterialCommunityIcons 
                name={hasVoicePending ? 'microphone-clock-outline' : 'email-fast-outline'} 
                size={28} 
                color={theme.customColors.warning} 
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[theme.typography.body, { fontWeight: '600' }]}>
                  {pendingTransactionsCount === 1
                    ? `Tienes 1 movimiento por confirmar${hasVoicePending ? ' (🎙️ Reloj)' : ''}`
                    : `Tienes ${pendingTransactionsCount} movimientos por confirmar`}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                  {hasVoicePending
                    ? 'Notas de voz del reloj sin monto o notificaciones bancarias'
                    : 'Notificaciones bancarias y facturas detectadas automáticamente'}
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
            {liquidAccounts.map(account => {
              const brand = getAccountBrandInfo(account);
              return (
                <List.Item
                  key={account.id}
                  title={account.name}
                  description={
                    (account.type === 'cash' ? 'Efectivo' : 'Cuenta de ahorro/corriente') +
                    (account.isPrivate ? ' • 🙈 Privada' : '')
                  }
                  onPress={() => setSelectedAccountForAction(account)}
                  left={() => (
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: brand.color,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginLeft: 8,
                        alignSelf: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <MaterialCommunityIcons name={brand.icon as any} size={20} color="#FFFFFF" />
                    </View>
                  )}
                  right={() => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <AmountDisplay amount={account.initialBalance} size="sm" type="neutral" style={styles.itemAmount} />
                      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.customColors.textSecondary} />
                    </View>
                  )}
                  style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                />
              );
            })}
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
              {creditCards.map(account => {
                const brand = getAccountBrandInfo(account);
                return (
                  <List.Item
                    key={account.id}
                    title={account.name}
                    description={
                      account.closingDay
                        ? `Día de corte: ${account.closingDay}` + (account.isPrivate ? ' • 🙈 Privada' : '')
                        : account.isPrivate ? '🙈 Cuenta privada' : 'Tarjeta de crédito'
                    }
                    onPress={() => setSelectedAccountForAction(account)}
                    left={() => (
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: brand.color,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginLeft: 8,
                          alignSelf: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <MaterialCommunityIcons name={brand.icon as any} size={20} color="#FFFFFF" />
                      </View>
                    )}
                    right={() => (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AmountDisplay amount={account.initialBalance} size="sm" type="expense" style={styles.itemAmount} />
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.customColors.textSecondary} />
                      </View>
                    )}
                    style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                  />
                );
              })}
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
              {loanAccounts.map(account => {
                const brand = getAccountBrandInfo(account);
                return (
                  <List.Item
                    key={account.id}
                    title={account.name}
                    description={
                      'Préstamo / Crédito' +
                      (account.isPrivate ? ' • 🙈 Privado' : '')
                    }
                    onPress={() => setSelectedAccountForAction(account)}
                    left={() => (
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: brand.color,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginLeft: 8,
                          alignSelf: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <MaterialCommunityIcons name={brand.icon as any} size={20} color="#FFFFFF" />
                      </View>
                    )}
                    right={() => (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AmountDisplay amount={account.initialBalance} size="sm" type="expense" style={styles.itemAmount} />
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.customColors.textSecondary} />
                      </View>
                    )}
                    style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                  />
                );
              })}
            </List.Accordion>
          )}

          {/* 4. Inversiones y Patrimonio */}
          {investmentAccounts.length > 0 && (
            <List.Accordion
              title="Inversiones y Patrimonio"
              description={`${investmentAccounts.length} ${investmentAccounts.length === 1 ? 'cuenta de capital' : 'cuentas de capital'}`}
              expanded={investmentsExpanded}
              onPress={() => setInvestmentsExpanded(!investmentsExpanded)}
              left={props => <List.Icon {...props} icon="chart-line" color="#059669" />}
              right={() => (
                <AmountDisplay amount={totalInvestmentsSum} size="sm" type="income" style={styles.headerAmount} />
              )}
              style={[styles.accordionHeader, { backgroundColor: theme.colors.surface, marginTop: 8 }]}
            >
              {investmentAccounts.map(account => {
                const brand = getAccountBrandInfo(account);
                return (
                  <List.Item
                    key={account.id}
                    title={account.name}
                    description={
                      'Inversión / CDT / Fiduciaria' + (account.isPrivate ? ' • 🙈 Privada' : '')
                    }
                    onPress={() => setSelectedAccountForAction(account)}
                    left={() => (
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: brand.color || '#059669',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginLeft: 8,
                          alignSelf: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <MaterialCommunityIcons name={(brand.icon as any) || 'trending-up'} size={20} color="#FFFFFF" />
                      </View>
                    )}
                    right={() => (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AmountDisplay amount={account.initialBalance} size="sm" type="income" style={styles.itemAmount} />
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.customColors.textSecondary} />
                      </View>
                    )}
                    style={[styles.accordionItem, { backgroundColor: theme.colors.surfaceVariant }]}
                  />
                );
              })}
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
                  authorInitials={tx.createdByUserId !== currentUserId ? familyMembers[tx.createdByUserId] : null}
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

      {/* ─── MODAL ACCIONES RÁPIDAS DE CUENTA ────────────────────────────── */}
      <Portal>
        <Dialog
          visible={!!selectedAccountForAction}
          onDismiss={() => setSelectedAccountForAction(null)}
          style={{
            borderRadius: 20,
            maxWidth: Platform.OS === 'web' ? 560 : '100%',
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Dialog.Title style={{ fontWeight: 'bold' }}>
            {selectedAccountForAction?.name}
          </Dialog.Title>
          <Dialog.Content>
            {selectedAccountForAction && (
              <View style={{ gap: 12 }}>
                {accountStats.startDateStr && (
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                    📅 Activa desde: {accountStats.startDateStr}
                  </Text>
                )}

                <View>
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 2 }]}>
                    Saldo actual registrado:
                  </Text>
                  <AmountDisplay
                    amount={selectedAccountForAction.initialBalance}
                    size="md"
                    type={
                      ['credit_card', 'loan', 'mortgage'].includes(selectedAccountForAction.type)
                        ? 'expense'
                        : 'neutral'
                    }
                  />
                </View>

                {/* Resumen Histórico de Ingresos y Egresos de Todos los Tiempos */}
                {accountStats.isLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 8 }} />
                ) : (
                  <Surface style={{ padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceVariant, gap: 8 }}>
                    <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
                      Histórico acumulado (Todos los tiempos):
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurface }]}>
                        🟢 Total Ingresos:
                      </Text>
                      <AmountDisplay amount={accountStats.totalIncome} size="sm" type="income" />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurface }]}>
                        🔴 Total Gastos:
                      </Text>
                      <AmountDisplay amount={accountStats.totalExpenses} size="sm" type="expense" />
                    </View>
                  </Surface>
                )}

                {selectedAccountForAction.type === 'credit_card' && selectedAccountForAction.closingDay && (
                  <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
                    💳 Día de corte asignado: {selectedAccountForAction.closingDay}
                  </Text>
                )}

                {selectedAccountForAction.isPrivate && (
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                    🙈 Esta cuenta está marcada como privada.
                  </Text>
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions style={{ flexDirection: 'column', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button
              mode="contained"
              icon="format-list-bulleted"
              style={{ width: '100%' }}
              onPress={() => {
                const accId = selectedAccountForAction?.id;
                setSelectedAccountForAction(null);
                if (accId) {
                  router.push({ pathname: '/transactions', params: { accountId: accId } });
                }
              }}
            >
              Ver Movimientos de esta Cuenta
            </Button>
            <Button
              mode="outlined"
              icon="plus-circle-outline"
              style={{ width: '100%' }}
              onPress={() => {
                const accId = selectedAccountForAction?.id;
                setSelectedAccountForAction(null);
                if (accId) {
                  router.push({ pathname: '/transaction/new', params: { accountId: accId } });
                }
              }}
            >
              Registrar Gasto con esta Cuenta
            </Button>
            <Button
              onPress={() => setSelectedAccountForAction(null)}
              textColor={theme.customColors.textSecondary}
              style={{ marginTop: 4 }}
            >
              Cerrar
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Modal de Salud Financiera & Framework de Metodologías (50/30/20, 70/20/10, FIRE) */}
        <FinancialHealthModal
          visible={healthModalVisible}
          onDismiss={() => setHealthModalVisible(false)}
          transactions={monthTransactions}
          categories={categories}
          accounts={allAccounts}
        />
      </Portal>

      <Snackbar
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
        duration={6000}
        action={
          toastTxId
            ? {
                label: params.voiceToastPending === 'true' ? 'Completar' : 'Editar',
                onPress: () => {
                  router.push({ pathname: '/transaction/new', params: { id: toastTxId } });
                },
              }
            : undefined
        }
        style={{ backgroundColor: theme.colors.elevation.level3, marginBottom: 70 }}
      >
        <Text style={{ color: theme.colors.onSurface }}>{toastMessage}</Text>
      </Snackbar>
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
  alertCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    paddingBottom: 115,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 960 : '100%',
    alignSelf: 'center',
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
