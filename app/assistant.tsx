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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

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

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  suggestedActions?: string[];
  createdAt: Date;
}

export default function AssistantScreen() {
  const theme = useAppTheme();
  const router = useRouter();
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
      if (history.length > 0) {
        setMessages(history.map(h => ({
          id: h.id,
          sender: h.sender,
          text: h.content,
          suggestedActions: h.suggestedActions,
          createdAt: new Date(h.createdAt),
        })));
      } else {
        setMessages([makeWelcomeMessage(userProfile?.displayName)]);
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

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.answer,
        suggestedActions: response.suggestedActions,
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

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.messageRow, isAi ? styles.rowAi : styles.rowUser]}>
        {isAi && (
          <Avatar.Icon
            size={36}
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
              },
            ]}
          >
            <Card.Content style={styles.bubbleContent}>
              <Text
                style={[
                  styles.messageText,
                  theme.typography.body,
                  { color: isAi ? theme.colors.onSurface : '#FFFFFF' },
                ]}
              >
                {item.text}
              </Text>
            </Card.Content>
          </Card>

          {/* Acciones sugeridas de respuesta rápida */}
          {isAi && item.suggestedActions && item.suggestedActions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {item.suggestedActions.map((action, index) => (
                <Button
                  key={index}
                  mode="outlined"
                  compact
                  onPress={() => handleSendMessage(action)}
                  style={styles.suggestionBtn}
                  labelStyle={theme.typography.caption}
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
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]}>
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
      <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
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
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
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
    lineHeight: 20,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  suggestionBtn: {
    marginRight: 6,
    marginBottom: 6,
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
});
