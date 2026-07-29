/**
 * ZenMoney — Chat Asistente Financiero IA
 *
 * Interfaz interactiva de conversación (Q&A) que permite al usuario formular
 * preguntas en lenguaje natural sobre sus finanzas, alimentándose del
 * contexto real consolidado.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { AppAlert } from '@/src/presentation/services/AppAlert';
import { Text, TextInput, Button, Card, Avatar, ActivityIndicator, IconButton } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { GeminiFlashProvider } from '@/src/infrastructure/ai/GeminiFlashProvider';
import { SupabaseAccountRepository } from '@/src/data/repositories/SupabaseAccountRepository';
import { SupabaseTransactionRepository } from '@/src/data/repositories/SupabaseTransactionRepository';
import { SupabaseCategoryRepository } from '@/src/data/repositories/SupabaseCategoryRepository';
import { SupabaseBudgetRepository } from '@/src/data/repositories/SupabaseBudgetRepository';
import { SupabaseAssistantMessageRepository } from '@/src/data/repositories/SupabaseAssistantMessageRepository';
import { CalculateBudgetProgress } from '@/src/domain/usecases/CalculateBudgetProgress';
import { FinancialContext, ConversationTurn } from '@/src/infrastructure/ai/AIProvider';
import { Account } from '@/src/domain/entities/Account';
import { Transaction } from '@/src/domain/entities/Transaction';
import { BudgetProgress } from '@/src/domain/entities/Budget';
import { Challenge } from '@/src/domain/entities/Challenge';
import { HybridChallengeRepository } from '@/src/data/repositories/HybridChallengeRepository';
import { AnomalyDetectorService } from '@/src/infrastructure/services/AnomalyDetectorService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HISTORY_WINDOW = 20; // turnos recientes que se mandan a Gemini como memoria

function makeWelcomeMessage(displayName?: string): Message {
  return {
    id: 'welcome',
    sender: 'ai',
    text: `¡Hola, ${displayName || 'hola'}! Soy tu Asistente Financiero ZenMoney 🤖. \n\nPuedes preguntarme cosas sobre tus presupuestos, tus saldos de cuentas, o consejos para ahorrar este mes. ¿En qué te ayudo hoy?`,
    suggestedActions: [
      '¿Cómo van mis presupuestos?',
      '¿Cuál es mi saldo disponible?',
      'Resumen de gastos de este mes',
    ],
    createdAt: new Date(),
  };
}

export interface MessagePendingAction {
  type: 'create_transaction' | 'create_challenge';
  payload: any;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  suggestedActions?: string[];
  pendingAction?: MessagePendingAction;
  createdAt: Date;
}

export default function AssistantScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [financialContext, setFinancialContext] = useState<FinancialContext | null>(null);

  const flatListRef = useRef<FlatList>(null);
  
  // Proveedores y Repositorios
  const aiProvider = new GeminiFlashProvider();
  const accountRepo = new SupabaseAccountRepository();
  const transactionRepo = new SupabaseTransactionRepository();
  const categoryRepo = new SupabaseCategoryRepository();
  const budgetRepo = new SupabaseBudgetRepository();
  const budgetProgressUseCase = new CalculateBudgetProgress(transactionRepo);
  const assistantMessageRepo = new SupabaseAssistantMessageRepository();

  // 1. Cargar la conversación persistida (memoria entre sesiones) y recolectar contexto
  useEffect(() => {
    loadConversation();
    gatherFinancialContext();
  }, []);

  const loadConversation = async () => {
    try {
      const history = await assistantMessageRepo.getRecent(HISTORY_WINDOW * 2);
      
      // 1. Escanear Anomalías
      const anomalyService = new AnomalyDetectorService();
      const alerts = await anomalyService.scanForAnomalies();
      const newAlerts: Message[] = [];
      
      for (const alertText of alerts) {
        // Verificar si la IA ya ha enviado esta alerta exacta recientemente
        const alreadySent = history.some(h => h.content === alertText);
        if (!alreadySent) {
          const newAlert: Message = {
            id: (Date.now() + Math.random()).toString(),
            sender: 'ai',
            text: alertText,
            createdAt: new Date(),
          };
          newAlerts.push(newAlert);
          
          // Persistir la alerta generada
          await assistantMessageRepo.create({
            sender: 'ai',
            content: alertText
          });
        }
      }

      let loadedMessages: Message[] = [];
      if (history.length > 0) {
        loadedMessages = history.map(h => ({
          id: h.id,
          sender: h.sender,
          text: h.content,
          suggestedActions: h.suggestedActions,
          createdAt: new Date(h.createdAt),
        }));
      } else {
        loadedMessages = [makeWelcomeMessage(userProfile?.displayName)];
      }

      // Añadir las nuevas alertas al final
      setMessages([...loadedMessages, ...newAlerts]);
      
      if (newAlerts.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      }
    } catch (err) {
      console.warn('[Assistant History Load Error]:', err);
      setMessages([makeWelcomeMessage(userProfile?.displayName)]);
    }
  };

  const handleNewConversation = () => {
    AppAlert.alert(
      'Nueva conversación',
      '¿Quieres borrar el historial de esta conversación? El asistente dejará de recordar lo que hablaron.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await assistantMessageRepo.deleteAll();
            } catch (err) {
              console.warn('[Assistant Delete History Error]:', err);
            }
            setMessages([makeWelcomeMessage(userProfile?.displayName)]);
          },
        },
      ]
    );
  };

  /**
   * Recolecta todos los datos financieros del usuario para construir el contexto
   * enriquecido que se le inyectará a Gemini.
   */
  const gatherFinancialContext = async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Cargar cuentas
      const loadedAccounts = await accountRepo.getAll();
      const activeAccounts = loadedAccounts.filter(a => a.isActive);

      // Calcular Disponible
      const cash = activeAccounts.filter(acc => ['cash', 'bank', 'investment'].includes(acc.type));
      const debt = activeAccounts.filter(acc => acc.type === 'credit_card');
      const cashSum = cash.reduce((sum, acc) => sum + Number(acc.initialBalance), 0);
      const debtSum = debt.reduce((sum, acc) => sum + Math.abs(Number(acc.initialBalance)), 0);
      const totalBalance = cashSum - debtSum;

      // Cargar categorías y presupuestos
      const categories = await categoryRepo.getAll(true);
      const budgets = await budgetRepo.getByMonth(currentYear, currentMonth);

      // Calcular consumos de presupuestos
      const budgetsProgressPromises = budgets.map(b => budgetProgressUseCase.execute(b));
      const budgetProgress = await Promise.all(budgetsProgressPromises);

      // Cargar transacciones del mes
      const lastDay = new Date(currentYear, now.getMonth() + 1, 0).getDate();
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const recentTransactions = await transactionRepo.getAll({ limit: 10 });
      const monthlyTransactions = await transactionRepo.getAll({ startDate, endDate });

      // Calcular ingresos y gastos del mes
      const monthlyIncome = monthlyTransactions
        .filter(t => t.type === 'income' && t.status === 'confirmed')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const monthlyExpenses = monthlyTransactions
        .filter(t => t.type === 'expense' && t.status === 'confirmed')
        .reduce((sum, t) => sum + t.amount, 0);

      // Mapear nombres a los IDs de categorías para que Gemini entienda texto semántico
      const mappedBudgetProgress: BudgetProgress[] = budgetProgress.map(bp => {
        const catName = categories.find(c => c.id === bp.budget.categoryId)?.name || 'Sin clasificar';
        return {
          ...bp,
          budget: {
            ...bp.budget,
            categoryId: catName // Reemplazar ID por nombre para la IA
          }
        };
      });

      setFinancialContext({
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        budgets: mappedBudgetProgress,
        recentTransactions,
        accounts: activeAccounts,
        categories,
        currentDate: now.toISOString().split('T')[0],
        currency: 'COP',
      });
    } catch (err) {
      console.warn('[Assistant Context Error]:', err);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !financialContext) return;

    // 1. Agregar mensaje del usuario en pantalla
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      createdAt: new Date(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Auto-scroll
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Persistir el turno del usuario — memoria entre sesiones. No bloquea la conversación si falla.
    assistantMessageRepo.create({ sender: 'user', content: textToSend }).catch(err =>
      console.warn('[Assistant Save User Message Error]:', err)
    );

    try {
      // 2. Historial reciente (sin el saludo efímero) para que Gemini recuerde la conversación
      const history: ConversationTurn[] = messages
        .filter(m => m.id !== 'welcome')
        .slice(-HISTORY_WINDOW)
        .map(m => ({ role: m.sender === 'user' ? 'user' as const : 'model' as const, text: m.text }));

      // 3. Enviar a Gemini junto al contexto financiero recolectado y el historial
      const response = await aiProvider.queryFinances(textToSend, financialContext, history);

      let pendingActionToAttach: MessagePendingAction | undefined = undefined;

      if (response.pendingAction) {
        pendingActionToAttach = {
          type: response.pendingAction.type,
          payload: response.pendingAction.payload,
          status: 'pending',
        };
      } else {
        // Fallback inteligente: si el mensaje del usuario suena a registrar un gasto pero Gemini omitió el JSON del pendingAction, invocamos parseTransaction
        const keywords = ['gasto', 'gasté', 'pagué', 'compré', 'mercado', 'restaurante', 'gasolina', 'registra', 'anota', 'vale'];
        const isTransactionIntent = keywords.some(kw => textToSend.toLowerCase().includes(kw));

        if (isTransactionIntent) {
          try {
            const parsed = await aiProvider.parseTransaction(textToSend, financialContext.accounts, financialContext.categories);
            if (parsed.amount && parsed.amount > 0) {
              pendingActionToAttach = {
                type: 'create_transaction',
                payload: {
                  amount: parsed.amount,
                  transactionType: parsed.type || 'expense',
                  suggestedCategoryName: parsed.suggestedCategoryName || 'Mercado',
                  suggestedAccountName: parsed.suggestedAccountName || 'Efectivo',
                  description: parsed.description || parsed.suggestedCategoryName || textToSend,
                  transactionDate: parsed.transactionDate || financialContext.currentDate,
                },
                status: 'pending',
              };
            }
          } catch {
            // Ignorar fallback si la frase no contenía montos válidos
          }
        }
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.answer,
        suggestedActions: response.suggestedActions,
        pendingAction: pendingActionToAttach,
        createdAt: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);

      assistantMessageRepo
        .create({ sender: 'ai', content: response.answer, suggestedActions: response.suggestedActions })
        .catch(err => console.warn('[Assistant Save AI Message Error]:', err));
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Lo siento, no pude procesar tu consulta. ${err instanceof Error ? err.message : 'Error interno de red.'}`,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ─── ACCIONES HUMAN-IN-THE-LOOP (CONFIRMACIÓN PREVIA) ────────────────
  const handleConfirmPendingAction = async (messageId: string, action: MessagePendingAction) => {
    if (!financialContext) return;

    if (action.type === 'create_challenge') {
      try {
        const payload = action.payload;
        const challengeRepo = new HybridChallengeRepository();
        const todayStr = new Date().toISOString().split('T')[0];

        const newChallenge: Challenge = {
          id: `challenge-ai-${Date.now()}`,
          type: 'streak_7_days',
          title: payload.title || 'Desafío Adaptativo 7 Días',
          description: payload.description || 'Mantén tu disciplina durante los próximos 7 días.',
          icon: payload.icon || 'trophy',
          targetDays: 7,
          completedDays: 1,
          days: Array.from({ length: 7 }, (_, i) => ({
            dayNumber: i + 1,
            date: new Date(Date.now() + (i - 6) * 86400000).toISOString().split('T')[0],
            isCompleted: i === 6,
            isToday: i === 6,
          })),
          startDate: todayStr,
          endDate: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
          status: 'active',
          rewardBadgeTitle: payload.rewardBadgeTitle || '🏆 Héroe Financiero',
        };

        await challengeRepo.create(newChallenge);

        setMessages(prev =>
          prev.map(m => (m.id === messageId && m.pendingAction ? { ...m, pendingAction: { ...m.pendingAction, status: 'confirmed' } } : m))
        );

        const confirmMessage: Message = {
          id: Date.now().toString(),
          sender: 'ai',
          text: `🏆 **¡Desafío Aceptado con Éxito!**\nActivaste el reto **"${newChallenge.title}"**. Puedes hacerle seguimiento diario desde tu **Entrenador Financiero** 🏆 en el menú superior. ¡A ganar la insignia **${newChallenge.rewardBadgeTitle}**!`,
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, confirmMessage]);
      } catch (err) {
        AppAlert.alert('Error', err instanceof Error ? err.message : 'No se pudo activar el desafío.');
      }
      return;
    }

    try {
      const payload = action.payload;

      // Matchear categoría
      let matchedCatId = financialContext.categories.find(
        c => c.name.toLowerCase() === (payload.suggestedCategoryName || '').toLowerCase()
      )?.id;

      if (!matchedCatId) {
        const cat = financialContext.categories.find(
          c => c.name.toLowerCase().includes((payload.suggestedCategoryName || '').toLowerCase())
        );
        matchedCatId = cat?.id || financialContext.categories[0]?.id;
      }

      // Matchear cuenta
      let matchedAccId = financialContext.accounts.find(
        a => a.name.toLowerCase() === (payload.suggestedAccountName || '').toLowerCase()
      )?.id;

      if (!matchedAccId) {
        const acc = financialContext.accounts.find(
          a => a.name.toLowerCase().includes((payload.suggestedAccountName || '').toLowerCase())
        );
        matchedAccId = acc?.id || financialContext.accounts[0]?.id;
      }

      const newTxData = {
        amount: payload.amount,
        type: payload.transactionType || 'expense',
        categoryId: matchedCatId,
        accountId: matchedAccId,
        description: payload.description || payload.suggestedCategoryName || 'Gasto por Asistente IA',
        merchantName: payload.merchantName || null,
        transactionDate: payload.transactionDate || financialContext.currentDate,
        status: 'confirmed' as const,
        inputMethod: 'nlq' as const,
        isPrivate: false,
      };

      await transactionRepo.create(newTxData);

      // Cambiar estado de la tarjeta borrador en pantalla a confirmada
      setMessages(prev =>
        prev.map(m => (m.id === messageId && m.pendingAction ? { ...m, pendingAction: { ...m.pendingAction, status: 'confirmed' } } : m))
      );

      // Re-setear recordatorio de inactividad a 2 días
      try {
        const { RegistrationReminderService } = require('@/src/infrastructure/services/RegistrationReminderService');
        RegistrationReminderService.scheduleInactivityReminder(2).catch(() => {});
      } catch {}

      // Recargar el contexto financiero real
      await gatherFinancialContext();

      // Mensaje del sistema notificando éxito
      const confirmMessage: Message = {
        id: Date.now().toString(),
        sender: 'ai',
        text: `✅ **¡Guardado con éxito en la Base de Datos!**\nSe insertó el gasto de **$ ${payload.amount.toLocaleString('es-CO')} COP** en **${payload.suggestedCategoryName || 'Mercado'}**. Tus saldos y presupuestos ya están actualizados en toda la app.`,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, confirmMessage]);
    } catch (err) {
      AppAlert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la transacción.');
    }
  };

  const handleCancelPendingAction = (messageId: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === messageId && m.pendingAction ? { ...m, pendingAction: { ...m.pendingAction, status: 'cancelled' } } : m))
    );
  };

  const handleAdjustPendingAction = (action: MessagePendingAction) => {
    const payload = action.payload;
    router.push({
      pathname: '/transaction/new',
      params: {
        amount: payload.amount.toString(),
        description: payload.description || '',
      }
    });
  };

  const handleActionClick = (actionText: string) => {
    const lower = actionText.toLowerCase();
    if (lower.includes('presupuesto')) {
      router.push('/(tabs)/budgets');
    } else if (lower.includes('cuenta') || lower.includes('saldo')) {
      router.push('/settings/accounts');
    } else if (lower.includes('factura')) {
      router.push('/(tabs)/bills');
    } else if (lower.includes('movimiento') || lower.includes('historial')) {
      router.push('/(tabs)/transactions');
    } else {
      handleSendMessage(actionText);
    }
  };

  const renderFormattedLine = (line: string, lineIndex: number, baseStyle: any) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Detectar si la línea es un ítem de viñeta (- , • , *)
    const isBullet = /^[•\-\*]\s+/.test(trimmed);
    const cleanLine = isBullet ? trimmed.replace(/^[•\-\*]\s+/, '') : trimmed;

    const parts = cleanLine.split(/\*\*(.*?)\*\*/g);

    return (
      <View
        key={lineIndex}
        style={[
          styles.lineBlock,
          isBullet && [
            styles.bulletCard,
            {
              backgroundColor: theme.colors.surfaceVariant + '40',
              borderColor: theme.colors.outline + '40',
            },
          ],
        ]}
      >
        <Text style={[baseStyle, { lineHeight: 22 }]}>
          {parts.map((part, i) => {
            if (i % 2 === 1) {
              return (
                <Text
                  key={i}
                  style={[
                    baseStyle,
                    {
                      fontWeight: '800',
                      color: theme.colors.primary,
                    },
                  ]}
                >
                  {part}
                </Text>
              );
            }
            return <Text key={i}>{part}</Text>;
          })}
        </Text>
      </View>
    );
  };

  const renderRichText = (text: string, baseStyle: any) => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    return (
      <View style={styles.richTextContainer}>
        {lines.map((line, index) => renderFormattedLine(line, index, baseStyle))}
      </View>
    );
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.messageRow, isAi ? styles.rowAi : styles.rowUser]}>
        {isAi && (
          <Avatar.Icon
            size={34}
            icon="robot"
            style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
            color="#FFFFFF"
          />
        )}
        <View style={styles.bubbleContainer}>
          <Card
            style={[
              styles.bubble,
              {
                backgroundColor: isAi ? theme.colors.surface : theme.colors.primary,
                borderTopLeftRadius: isAi ? 4 : 16,
                borderTopRightRadius: isAi ? 16 : 4,
                elevation: isAi ? 2 : 1,
              },
            ]}
          >
            <Card.Content style={styles.bubbleContent}>
              {isAi ? (
                renderRichText(item.text, [
                  styles.messageText,
                  theme.typography.body,
                  { color: theme.colors.onSurface },
                ])
              ) : (
                <Text
                  style={[
                    styles.messageText,
                    theme.typography.body,
                    { color: '#FFFFFF' },
                  ]}
                >
                  {item.text}
                </Text>
              )}
            </Card.Content>
          </Card>

              {/* Tarjeta Borrador de Pre-Confirmación (Human-in-the-Loop) */}
              {isAi && item.pendingAction && (
                <Card style={[styles.draftCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary + '50' }]}>
                  <Card.Content style={{ padding: 12 }}>
                    {item.pendingAction.type === 'create_challenge' ? (
                      <>
                        <View style={styles.draftCardHeader}>
                          <MaterialCommunityIcons
                            name={item.pendingAction.status === 'confirmed' ? 'trophy' : item.pendingAction.status === 'cancelled' ? 'close-circle' : 'trophy-outline'}
                            size={22}
                            color={item.pendingAction.status === 'confirmed' ? '#059669' : item.pendingAction.status === 'cancelled' ? theme.colors.error : '#F97316'}
                          />
                          <Text style={[styles.draftCardTitle, { color: item.pendingAction.status === 'confirmed' ? '#059669' : item.pendingAction.status === 'cancelled' ? theme.colors.error : '#F97316' }]}>
                            {item.pendingAction.status === 'confirmed'
                              ? '¡Desafío Activado!'
                              : item.pendingAction.status === 'cancelled'
                              ? 'Desafío Omitido'
                              : 'Propuesta de Desafío 7 Días'}
                          </Text>
                        </View>

                        <View style={styles.draftRow}>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Reto:</Text>
                          <Text style={[theme.typography.body, { fontWeight: '800', color: theme.colors.onSurface }]}>
                            {item.pendingAction.payload.title || 'Desafío de 7 Días'}
                          </Text>
                        </View>

                        <View style={styles.draftRow}>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Insignia:</Text>
                          <Text style={[theme.typography.body, { fontWeight: '700', color: '#F97316' }]}>
                            {item.pendingAction.payload.rewardBadgeTitle || '🏆 Insignia Especial'}
                          </Text>
                        </View>

                        {item.pendingAction.status === 'pending' && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                            <Button
                              mode="contained"
                              icon="trophy-outline"
                              onPress={() => handleConfirmPendingAction(item.id, item.pendingAction!)}
                              style={{ flex: 1, borderRadius: 10, backgroundColor: '#F97316' }}
                              labelStyle={{ fontSize: 11, fontWeight: '700' }}
                            >
                              ¡Aceptar Desafío de 7 Días!
                            </Button>
                            <IconButton
                              icon="close-circle-outline"
                              mode="outlined"
                              iconColor={theme.colors.error}
                              size={18}
                              onPress={() => handleCancelPendingAction(item.id)}
                              style={{ margin: 0 }}
                            />
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <View style={styles.draftCardHeader}>
                          <MaterialCommunityIcons 
                            name={item.pendingAction.status === 'confirmed' ? 'check-circle' : item.pendingAction.status === 'cancelled' ? 'close-circle' : 'file-document-edit-outline'} 
                            size={22} 
                            color={item.pendingAction.status === 'confirmed' ? '#059669' : item.pendingAction.status === 'cancelled' ? theme.colors.error : theme.colors.primary} 
                          />
                          <Text style={[styles.draftCardTitle, { color: item.pendingAction.status === 'confirmed' ? '#059669' : item.pendingAction.status === 'cancelled' ? theme.colors.error : theme.colors.primary }]}>
                            {item.pendingAction.status === 'confirmed'
                              ? 'Gasto Registrado con Éxito'
                              : item.pendingAction.status === 'cancelled'
                              ? 'Acción Descartada'
                              : 'Pre-Registro de Gasto (Borrador)'}
                          </Text>
                        </View>

                        <View style={styles.draftRow}>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Monto:</Text>
                          <Text style={[theme.typography.body, { fontWeight: '800', color: theme.colors.onSurface }]}>
                            $ {Number(item.pendingAction.payload.amount).toLocaleString('es-CO')} COP
                          </Text>
                        </View>

                        <View style={styles.draftRow}>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Categoría:</Text>
                          <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.primary }]}>
                            {item.pendingAction.payload.suggestedCategoryName || 'Mercado'}
                          </Text>
                        </View>

                        <View style={styles.draftRow}>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Cuenta Origen:</Text>
                          <Text style={[theme.typography.body, { fontWeight: '600', color: theme.colors.onSurface }]}>
                            {item.pendingAction.payload.suggestedAccountName || 'Cuenta principal'}
                          </Text>
                        </View>

                        {item.pendingAction.status === 'pending' && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                            <Button
                              mode="contained"
                              icon="check-circle-outline"
                              onPress={() => handleConfirmPendingAction(item.id, item.pendingAction!)}
                              style={{ flex: 1, borderRadius: 10, backgroundColor: theme.colors.primary }}
                              labelStyle={{ fontSize: 11, fontWeight: '700' }}
                            >
                              Confirmar y Guardar
                            </Button>
                            <IconButton
                              icon="pencil-outline"
                              mode="outlined"
                              size={18}
                              onPress={() => handleAdjustPendingAction(item.pendingAction!)}
                              style={{ margin: 0 }}
                            />
                            <IconButton
                              icon="close-circle-outline"
                              mode="outlined"
                              iconColor={theme.colors.error}
                              size={18}
                              onPress={() => handleCancelPendingAction(item.id)}
                              style={{ margin: 0 }}
                            />
                          </View>
                        )}
                      </>
                    )}
                  </Card.Content>
                </Card>
              )}

              {/* Tarjetas Visuales de Acción Rápida (Action Chips Limpios) */}
              {isAi && item.suggestedActions && item.suggestedActions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {item.suggestedActions.map((action, index) => (
                    <Button
                      key={index}
                      mode="contained-tonal"
                      compact
                      icon="creation"
                      onPress={() => handleActionClick(action)}
                      style={styles.suggestionBtn}
                      labelStyle={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: theme.colors.primary,
                      }}
                    >
                      {action}
                    </Button>
                  ))}
                </View>
              )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Cabecera Modal */}
      <View style={[
        styles.header, 
        { 
          backgroundColor: theme.colors.surface, 
          borderBottomColor: theme.colors.outline,
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 10)
        }
      ]}>
        <IconButton icon="chevron-down" size={28} onPress={() => router.back()} />
        <Text style={[styles.headerTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
          Asistente Financiero IA
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="refresh" size={20} onPress={gatherFinancialContext} />
          <IconButton icon="delete-outline" size={20} onPress={handleNewConversation} />
        </View>
      </View>

      {/* Lista de burbujas */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={() => 
          isTyping ? (
            <View style={styles.typingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.typingText, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                Gemini está analizando tus finanzas...
              </Text>
            </View>
          ) : null
        }
      />

      {/* Caja de entrada inferior */}
      <View style={[
        styles.inputBar, 
        { 
          backgroundColor: theme.colors.surface, 
          borderTopColor: theme.colors.outline,
          paddingBottom: Math.max(insets.bottom, 10)
        }
      ]}>
        <TextInput
          placeholder="Pregúntale a ZenMoney..."
          value={inputText}
          onChangeText={setInputText}
          mode="flat"
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          style={styles.input}
          disabled={isTyping}
          onSubmitEditing={() => handleSendMessage(inputText)}
        />
        <IconButton
          icon="send"
          iconColor={theme.colors.primary}
          disabled={!inputText.trim() || isTyping}
          onPress={() => handleSendMessage(inputText)}
        />
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  rowAi: {
    alignSelf: 'flex-start',
  },
  rowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    maxWidth: '80%',
  },
  avatar: {
    marginRight: 8,
    marginTop: 4,
  },
  bubbleContainer: {
    flex: 1,
  },
  bubble: {
    borderRadius: 16,
    elevation: 1,
  },
  bubbleContent: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  messageText: {
    lineHeight: 22,
  },
  richTextContainer: {
    gap: 6,
  },
  lineBlock: {
    marginVertical: 2,
  },
  bulletCard: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  suggestionBtn: {
    borderRadius: 20,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 44,
    marginTop: 8,
  },
  typingText: {
    marginLeft: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: 'transparent',
  },
  draftCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    width: '100%',
  },
  draftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  draftCardTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  draftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
});
