/**
 * ZenMoney — Dashboard Principal Optimizado para Alto Volumen
 *
 * Muestra el balance general y liquidez en un formato de acordeones estructurados
 * y colapsables, ideal para usuarios con múltiples cuentas, tarjetas y créditos.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Platform, TouchableOpacity, Image } from 'react-native';
import { Text, FAB, Surface, ActivityIndicator, Button, List, IconButton, Card, Portal, Dialog } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import { BalanceCard, TransactionCard, EmptyState, AmountDisplay, NetworkStatusBar } from '@/src/presentation/components';
import { getAccountBrandInfo } from '@/src/presentation/theme/accountBrands';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
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
import { AnomalyDetectorService } from '@/src/infrastructure/services/AnomalyDetectorService';
import { SupabaseUserProfileRepository } from '@/src/data/repositories/SupabaseUserProfileRepository';
import { useRouter, useFocusEffect } from 'expo-router';
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
  const [creditCards, setCreditCards] = useState<Account[]>([]);
  const [loanAccounts, setLoanAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Saldos consolidados
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [pendingEmailInvoices, setPendingEmailInvoices] = useState(0);
  const [registrationStreak, setRegistrationStreak] = useState(0);
  const [registrationGapDays, setRegistrationGapDays] = useState<number | null>(null);
  
  // Alertas Inteligentes
  const [smartAlerts, setSmartAlerts] = useState<string[]>([]);

  // Estados de control de colapsables (Acordeones - Colapsados por defecto para una vista compacta)
  const [liquidExpanded, setLiquidExpanded] = useState(false);
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
    
    if (!force && !isNewTimeframe && Date.now() - lastLoadRef.current < 5000) {
      return;
    }
    lastLoadRef.current = Date.now();
    lastLoadedMonthRef.current = selectedMonth;
    lastLoadedYearRef.current = selectedYear;
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

      // Calcular resumen financiero mensual y rango de fechas
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthStr = String(selectedMonth).padStart(2, '0');
      const startDate = `${selectedYear}-${monthStr}-01`;
      const endDate = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      // 3. Cargar movimientos recientes limitados al mes seleccionado
      const loadedTransactions = await transactionRepo.getAll({ 
        limit: 10, 
        status: 'confirmed',
        startDate,
        endDate
      });
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
      const summary = await summaryUseCase.execute(startDate, endDate);
      setMonthlyIncome(summary.totalIncome);
      setMonthlyExpenses(summary.totalExpenses);

      // 5. Escanear Anomalías Financieras
      const anomalyService = new AnomalyDetectorService();
      const alerts = await anomalyService.scanForAnomalies();
      setSmartAlerts(alerts);

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
    }, [selectedYear, selectedMonth])
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
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        {/* Alertas Inteligentes */}
        {smartAlerts.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            {smartAlerts.map((alert, index) => (
              <Surface key={index} style={[styles.alertCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
                <View style={styles.alertHeader}>
                  <MaterialCommunityIcons name="alert-decagram" size={20} color={theme.colors.primary} />
                  <Text style={[theme.typography.caption, { fontWeight: 'bold', color: theme.colors.primary, marginLeft: 8, flex: 1 }]}>
                    Alerta Inteligente
                  </Text>
                  <IconButton
                    icon="close"
                    size={18}
                    iconColor={theme.customColors.textSecondary}
                    onPress={() => {
                      // Descartar localmente
                      setSmartAlerts(prev => prev.filter((_, i) => i !== index));
                    }}
                    style={{ margin: 0 }}
                  />
                </View>
                {/* Parse Markdown-like bold text **bold** for the alert string */}
                <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurface, marginTop: 4, lineHeight: 20 }]}>
                  {alert.split(/\*\*(.*?)\*\*/g).map((part, i) => 
                    i % 2 === 1 ? (
                      <Text key={i} style={{ fontWeight: 'bold' }}>{part}</Text>
                    ) : (
                      <Text key={i}>{part}</Text>
                    )
                  )}
                </Text>
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
          onPressAnalysis={() => router.push('/analytics')}
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
        </View>

        {/* ─── SECCIÓN ACCIONES RÁPIDAS (1 sola fila compacta de 3 botones) ── */}
        <View style={{ marginTop: 16, marginBottom: 8 }}>
          <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface, marginBottom: 10 }]}>
            Acciones rápidas
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* 1. Escanear Recibo */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/transaction/new', params: { action: 'camera' } })}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.outline + '30',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.primaryContainer, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="camera" size={18} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface, fontSize: 11 }]}>
                Escanear
              </Text>
            </TouchableOpacity>

            {/* 2. Dictar por Voz */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/transaction/new', params: { mode: 'ai' } })}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.outline + '30',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.primaryContainer, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="microphone" size={18} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface, fontSize: 11 }]}>
                Voz
              </Text>
            </TouchableOpacity>

            {/* 3. Transferir */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/transaction/new', params: { mode: 'manual', type: 'transfer' } })}
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.outline + '30',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.primaryContainer, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface, fontSize: 11 }]}>
                Transferir
              </Text>
            </TouchableOpacity>
          </View>
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
          style={{ borderRadius: 20 }}
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
      </Portal>
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
