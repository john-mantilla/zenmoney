/**
 * ZenMoney — Formulario Inteligente de Transacciones (Rediseño Jerárquico)
 *
 * Ofrece un flujo simplificado para Ingresos, Transferencias y Gastos,
 * implementando selección de categorías de 2 niveles (Padre/Hijo) y inputs condicionales.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, Keyboard } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons, Card, HelperText, Surface, IconButton, ActivityIndicator, Switch, Divider, Portal, Dialog } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useAppTheme } from '@/src/presentation/theme';
import { getAccountBrandInfo } from '@/src/presentation/theme/accountBrands';
import { CategoryPickerMenu, NetworkStatusBar, CustomNumpad, NumpadBottomSheet, VoicePulseWave, CategoryBottomSheet, LiveBudgetMeter, MicroCelebrationModal, CelebrationType } from '@/src/presentation/components';
import { CalculateRegistrationStreak } from '@/src/domain/usecases/CalculateRegistrationStreak';
import { hapticLight, hapticSuccess } from '@/src/infrastructure/utils/haptics';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { SupabaseCategorizationRuleRepository } from '@/src/data/repositories/SupabaseCategorizationRuleRepository';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { SupabaseRecurringRuleRepository } from '@/src/data/repositories/SupabaseRecurringRuleRepository';
import { ValidateTransaction } from '@/src/domain/usecases/ValidateTransaction';
import { GetQuickAddSuggestions, QuickAddSuggestions } from '@/src/domain/usecases/GetQuickAddSuggestions';
import { MatchCategorizationRule } from '@/src/domain/usecases/MatchCategorizationRule';
import { LearnCategorizationFromCorrection } from '@/src/domain/usecases/LearnCategorizationFromCorrection';
import { CalculateBudgetProgress } from '@/src/domain/usecases/CalculateBudgetProgress';
import { ProjectBudgetExhaustion } from '@/src/domain/usecases/ProjectBudgetExhaustion';
import { DetectAtypicalExpense } from '@/src/domain/usecases/DetectAtypicalExpense';
import { CalculateAccountBalance } from '@/src/domain/usecases/CalculateAccountBalance';
import { ProjectMonthlyRunway } from '@/src/domain/usecases/ProjectMonthlyRunway';
import { BudgetAlertService } from '@/src/infrastructure/services/BudgetAlertService';
import { Account } from '@/src/domain/entities/Account';
import { Category } from '@/src/domain/entities/Category';
import { Transaction } from '@/src/domain/entities/Transaction';
import { CategorizationRule } from '@/src/domain/entities/CategorizationRule';
import { GeminiFlashProvider } from '@/src/infrastructure/ai/GeminiFlashProvider';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: (_event: string, _listener: Function) => void = () => {};

try {
  const speechPkg = require('expo-speech-recognition');
  if (speechPkg?.ExpoSpeechRecognitionModule) {
    ExpoSpeechRecognitionModule = speechPkg.ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent = speechPkg.useSpeechRecognitionEvent;
  }
} catch {
  // Módulo nativo no compilado en el cliente Expo Go actual
}

const WebSpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition 
    : null;

export default function NewTransactionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { userProfile } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Parámetros de edición
  // Parámetros de edición / pre-rellenado
  const params = useLocalSearchParams<{
    id?: string;
    type?: string;
    accountId?: string;
    transferToAccountId?: string;
    amount?: string;
    description?: string;
    action?: string;
    voiceInput?: string;
    autoProcess?: string;
    mode?: 'quick' | 'ai' | 'manual';
  }>();
  const id = params.id;
  const isEditing = !!id;

  // Estados de datos
  const [originalTx, setOriginalTx] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mode, setMode] = useState<'quick' | 'ai' | 'manual'>('quick');
  const [suggestions, setSuggestions] = useState<QuickAddSuggestions | null>(null);
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([]);
  // Categoría que sugirieron la IA o una regla aprendida, para detectar si el usuario la corrige al guardar
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [purchaseCurrency, setPurchaseCurrency] = useState<'COP' | 'USD'>('COP');
  const [exchangeRate, setExchangeRate] = useState('4000');
  const [loadingRate, setLoadingRate] = useState(false);
  const [isInstallments, setIsInstallments] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState('12');
  // Mapa de presupuestos precargados para el LiveBudgetMeter
  const [budgetSpentMap, setBudgetSpentMap] = useState<Record<string, { limit: number; spent: number }>>({});
  // Estado para disparar micro-celebraciones (inversión, racha, meta de ahorro)
  const [celebrationConfig, setCelebrationConfig] = useState<{
    visible: boolean;
    type: CelebrationType;
    title: string;
    description: string;
    badgeText?: string;
    amountFormatted?: string;
  } | null>(null);

  // Estados de carga y error
  const [isLoading, setIsLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Campos del formulario
  const [amount, setAmount] = useState('');
  const [isNumpadVisible, setIsNumpadVisible] = useState(false);
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [accountId, setAccountId] = useState('');
  
  // Selección jerárquica de categorías
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('');
  const [isCategorySheetVisible, setIsCategorySheetVisible] = useState(false);
  const [isAccountSheetVisible, setIsAccountSheetVisible] = useState(false);
  const [accountSelectorTarget, setAccountSelectorTarget] = useState<'origin' | 'destination'>('origin');

  const [description, setDescription] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isOptionalDetailsExpanded, setIsOptionalDetailsExpanded] = useState(false);

  // Entrada para IA
  const [aiInput, setAiInput] = useState('');
  const [aiPreviewData, setAiPreviewData] = useState<any | null>(null);

  // Repositorios
  const accountRepo = new HybridAccountRepository();
  const categoryRepo = new HybridCategoryRepository();
  const transactionRepo = new HybridTransactionRepository();
  const categorizationRuleRepo = new SupabaseCategorizationRuleRepository();
  const budgetRepo = new HybridBudgetRepository();
  const recurringRuleRepo = new SupabaseRecurringRuleRepository();
  const aiProvider = new GeminiFlashProvider();
  const validator = new ValidateTransaction();
  const quickAddUseCase = new GetQuickAddSuggestions(transactionRepo);
  const matchRuleUseCase = new MatchCategorizationRule();
  const learnCategorizationUseCase = new LearnCategorizationFromCorrection(categorizationRuleRepo);
  const historicTxsRef = React.useRef<Transaction[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Carga Crítica Ultrarrápida (<30ms): Cuentas y Categorías básicas
        const [loadedAccs, loadedCats] = await Promise.all([
          accountRepo.getAll(),
          categoryRepo.getAll(true),
        ]);

        const activeAccs = loadedAccs.filter(a => a.isActive);
        setAccounts(activeAccs);
        setCategories(loadedCats);

        if (isEditing && id) {
          setMode('manual');
          const tx = await transactionRepo.getById(id);
          if (tx) {
            setOriginalTx(tx);
            setAmount(String(tx.amount));
            setType(tx.type);
            setAccountId(tx.accountId);
            setDescription(tx.description || '');
            setMerchantName(tx.merchantName || '');
            setTransferToAccountId(tx.transferToAccountId || '');
            setTransactionDate(tx.transactionDate);
            setIsPrivate(tx.isPrivate);

            if (tx.categoryId) {
              const cat = loadedCats.find(c => c.id === tx.categoryId);
              if (cat) {
                if (cat.parentCategoryId) {
                  setSelectedParentCategoryId(cat.parentCategoryId);
                  setSelectedSubCategoryId(cat.id);
                } else {
                  setSelectedParentCategoryId(cat.id);
                  setSelectedSubCategoryId('');
                }
              }
            }
          }
        } else {
          if (params.type) setType(params.type as any);
          if (params.accountId) setAccountId(params.accountId);
          if (params.transferToAccountId) setTransferToAccountId(params.transferToAccountId);
          if (params.amount) setAmount(params.amount);
          if (params.description) setDescription(params.description);
          if (params.mode) setMode(params.mode as any);
          if (params.action === 'voice' || params.action === 'ai') setMode('ai');
          if (params.type === 'transfer') setMode('manual');

          if (activeAccs.length > 0 && !params.accountId) {
            setAccountId(activeAccs[0].id);
          }
        }

        // DESBLOQUEAR UI INMEDIATAMENTE (< 30ms) para respuesta instantánea de botones y atajos
        setIsLoading(false);

        // Si viene por atajo de voz/cámara o comando de Google Assistant (Smartwatch / Wear OS)
        if (params.voiceInput) {
          setMode('ai');
          setAiInput(params.voiceInput);
          setTimeout(async () => {
            try {
              setIsLoading(true);
              const parsed = await aiProvider.parseTransaction(params.voiceInput!, activeAccs, loadedCats);
              applyParsedResult(parsed);

              // Auto-Guardado Inteligente (Opción A): Si hay monto válido y cuentas disponibles
              const amountVal = parsed.amount ? Number(parsed.amount) : 0;
              if (amountVal > 0 && activeAccs.length > 0) {
                const targetAccountId = (parsed as any).suggestedAccountId || activeAccs[0].id;
                const learnedCatId = parsed.merchantName
                  ? matchRuleUseCase.execute(parsed.merchantName, categorizationRules)
                  : null;
                const targetCatId = learnedCatId || (parsed as any).suggestedCategoryId || (loadedCats.find(c => !c.parentCategoryId)?.id || '');
                const targetCatObj = loadedCats.find(c => c.id === targetCatId);

                const newTx = await transactionRepo.create({
                  type: parsed.type || 'expense',
                  amount: amountVal,
                  accountId: targetAccountId,
                  categoryId: targetCatId || undefined,
                  merchantName: parsed.merchantName || undefined,
                  description: parsed.description || params.voiceInput,
                  transactionDate: parsed.transactionDate || new Date().toISOString().split('T')[0],
                });

                hapticSuccess();

                // Redirigir inmediatamente al Resumen mostrando Snackbar interactivo
                router.replace({
                  pathname: '/(tabs)',
                  params: {
                    voiceToast: 'true',
                    voiceAmount: String(amountVal),
                    voiceCategory: targetCatObj?.name || 'Gasto',
                    voiceTxId: newTx.id,
                  },
                });
                return;
              } else if (amountVal === 0 && activeAccs.length > 0) {
                // Si falta el monto en el dictado, guardar en la bandeja "Por confirmar"
                await transactionRepo.create({
                  type: 'expense',
                  amount: 0,
                  accountId: activeAccs[0].id,
                  categoryId: loadedCats[0]?.id || '',
                  description: `🎙️ ${params.voiceInput}`,
                  transactionDate: new Date().toISOString().split('T')[0],
                });
                hapticSuccess();
                router.replace({
                  pathname: '/(tabs)',
                  params: {
                    voiceToastPending: 'true',
                  },
                });
                return;
              }
            } catch (err) {
              console.error('[VoiceInput] Error al procesar entrada de voz:', err);
            } finally {
              setIsLoading(false);
            }
          }, 150);
        } else if (params.action === 'camera') {
          setMode('ai');
          setTimeout(() => {
            handlePickReceipt('camera');
          }, 100);
        } else if (params.action === 'voice' || params.mode === 'ai') {
          setMode('ai');
          setTimeout(() => {
            handleStartSpeech();
          }, 300);
        }

        // 2. Carga Secundaria Asíncrona (Background — No bloquea la UI ni los botones)
        // Background A: Ordenar cuentas por frecuencia de uso del mes
        (async () => {
          try {
            const today = new Date();
            const startOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            const endOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
            const monthTransactions = await transactionRepo.getAll({ startDate: startOfMonth, endDate: endOfMonth });
            const usageCount: Record<string, number> = {};
            for (const tx of monthTransactions) {
              usageCount[tx.accountId] = (usageCount[tx.accountId] || 0) + 1;
            }
            const sorted = [...activeAccs].sort((a, b) => (usageCount[b.id] || 0) - (usageCount[a.id] || 0) || a.name.localeCompare(b.name));
            setAccounts(sorted);
          } catch {}
        })();

        // Background B: Precargar mapa de presupuestos para LiveBudgetMeter
        (async () => {
          try {
            const now = new Date();
            const currentBudgets = await budgetRepo.getByMonth(now.getFullYear(), now.getMonth() + 1);
            const calcProgress = new CalculateBudgetProgress(transactionRepo);
            const map: Record<string, { limit: number; spent: number }> = {};
            for (const b of currentBudgets) {
              const p = await calcProgress.execute(b, loadedCats);
              map[b.categoryId] = { limit: Number(b.amountLimit) || 0, spent: Number(p.spent) || 0 };
            }
            setBudgetSpentMap(map);
          } catch {}
        })();

        // Background C: Reglas de categorización e historial predictivo
        categorizationRuleRepo.getAll().then(setCategorizationRules).catch(() => {});
        transactionRepo.getAll({}).then(txs => { historicTxsRef.current = txs; }).catch(() => {});
        if (!isEditing) {
          quickAddUseCase.execute().then(setSuggestions).catch(() => {});
        }
      } catch (err) {
        setErrorMsg('Error al cargar la información financiera.');
        setIsLoading(false);
      }
    }
    loadData();
  }, [id, isEditing, params.action]);

  // Consulta de Tasa de Cambio en Tiempo Real (USD -> COP)
  const fetchRate = async () => {
    setLoadingRate(true);
    setErrorMsg(null);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) {
        throw new Error('Error al conectar con la API de tasas.');
      }
      const data = await response.json();
      const copRate = data.rates?.COP;
      if (copRate) {
        setExchangeRate(String(Math.round(copRate)));
      } else {
        setExchangeRate('4000'); // Fallback
      }
    } catch (err) {
      console.warn('[Exchange Rate Fetch Error]:', err);
      setErrorMsg('No se pudo obtener la tasa en línea. Usando valor por defecto.');
      setExchangeRate(prev => prev || '4000');
    } finally {
      setLoadingRate(false);
    }
  };

  useEffect(() => {
    if (purchaseCurrency === 'USD') {
      fetchRate();
    }
  }, [purchaseCurrency]);

  // ─── LÓGICA DE CATEGORÍAS FILTRADAS POR TIPO ─────────────────────────

  // Categorías de INGRESOS (directas)
  const incomeCategories = categories.filter(
    c => c.name.toLowerCase().includes('ingreso') || c.name.toLowerCase().includes('salario')
  );

  // Solo se puede ocultar del resto de la familia una transacción en una cuenta de
  // propiedad individual del usuario (nunca una cuenta compartida) y que no sea transferencia.
  const selectedAccount = accounts.find(a => a.id === accountId);
  const canBePrivate = type !== 'transfer' && !!selectedAccount && !!userProfile
    && selectedAccount.ownerUserId === userProfile.id;

  useEffect(() => {
    if (!canBePrivate && isPrivate) setIsPrivate(false);
  }, [canBePrivate]);

  const handlePredictiveCategorization = (text: string) => {
    if (!text || text.length < 3 || selectedParentCategoryId) return;
    
    // Buscar en el historial gastos recientes que coincidan con el texto
    const textLower = text.toLowerCase();
    const match = historicTxsRef.current.find(tx => 
      tx.type === 'expense' &&
      ((tx.description && tx.description.toLowerCase().includes(textLower)) ||
       (tx.merchantName && tx.merchantName.toLowerCase().includes(textLower)))
    );

    if (match && match.categoryId) {
      const cat = categories.find(c => c.id === match.categoryId);
      if (cat) {
        if (cat.parentCategoryId) {
          setSelectedParentCategoryId(cat.parentCategoryId);
          setSelectedSubCategoryId(cat.id);
        } else {
          setSelectedParentCategoryId(cat.id);
          setSelectedSubCategoryId('');
        }
        // Indicador de que fue sugerido por IA predictiva
        setSuggestedCategoryId(cat.id);
      }
    }
  };

  // ─── Funciones para Categorías ─────────────────────────────────────────
  const handleStartSpeech = () => {
    if (!WebSpeechRecognition) {
      setErrorMsg('Micrófono soportado solo en Web. Escribe la frase del gasto.');
      return;
    }
    try {
      const recognition = new WebSpeechRecognition();
      recognition.lang = 'es-CO';
      recognition.interimResults = false;
      recognition.onstart = () => { setIsListening(true); setErrorMsg(null); };
      recognition.onresult = (e: any) => setAiInput(e.results[0][0].transcript);
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setErrorMsg('No se pudo inicializar el micrófono.');
    }
  };

  // ─── Reconocimiento de voz (iOS / Android nativo) ─────────────────────
  useSpeechRecognitionEvent('result', (event: any) => {
    const transcript = event?.results?.[0]?.transcript;
    if (transcript) setAiInput(transcript);
  });
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('error', (event: any) => {
    setIsListening(false);
    setErrorMsg(
      event?.error === 'not-allowed'
        ? 'Necesitas dar permiso de micrófono para dictar el gasto.'
        : 'No se pudo reconocer el audio. Intenta de nuevo.'
    );
  });

  const handleStartNativeSpeech = async () => {
    if (!ExpoSpeechRecognitionModule) {
      handleStartSpeech();
      return;
    }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission?.granted) {
        setErrorMsg('Necesitas dar permiso de micrófono para dictar el gasto.');
        return;
      }
      setErrorMsg(null);
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({ lang: 'es-CO', interimResults: false });
    } catch {
      handleStartSpeech();
    }
  };

  const handleStopNativeSpeech = () => {
    if (ExpoSpeechRecognitionModule?.stop) {
      ExpoSpeechRecognitionModule.stop();
    }
    setIsListening(false);
  };

  // Un solo botón de micrófono: en web usa la Web Speech API del navegador,
  // en iOS/Android usa el reconocimiento nativo del dispositivo si está disponible.
  const handleMicPress = () => {
    if (Platform.OS === 'web' || !ExpoSpeechRecognitionModule) {
      handleStartSpeech();
    } else if (isListening) {
      handleStopNativeSpeech();
    } else {
      handleStartNativeSpeech();
    }
  };

  // Aplica al formulario el resultado de cualquier parseo de IA (frase de voz/texto o foto de
  // recibo): ambos devuelven el mismo NLQParseResult, así que comparten esta lógica.
  const applyParsedResult = (parsed: any) => {
    if (parsed.amount) setAmount(String(parsed.amount));
    if (parsed.type) setType(parsed.type);
    if (parsed.merchantName) setMerchantName(parsed.merchantName);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.transactionDate) setTransactionDate(parsed.transactionDate);

    const suggestedAccId = parsed.suggestedAccountId;
    const aiSuggestedCatId = parsed.suggestedCategoryId ?? null;

    if (suggestedAccId) setAccountId(suggestedAccId);

    // Una regla ya aprendida de una corrección previa le gana a la adivinanza de la IA
    const learnedCatId = parsed.merchantName
      ? matchRuleUseCase.execute(parsed.merchantName, categorizationRules)
      : null;
    const finalSuggestedCatId = learnedCatId || aiSuggestedCatId;

    applyCategoryId(finalSuggestedCatId);
    setSuggestedCategoryId(finalSuggestedCatId);

    setAiPreviewData(parsed);
    setMode('manual');
  };

  const handleProcessAI = async () => {
    if (!aiInput.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const parsed = await aiProvider.parseTransaction(aiInput, accounts, categories);
      applyParsedResult(parsed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al analizar la frase con IA.');
    } finally {
      setIsLoading(false);
    }
  };

  // Atajo: fotografiar o elegir de galería un recibo/factura para que la IA (visión) lo
  // analice y auto-rellene el formulario, igual que el flujo de voz/texto.
  const handlePickReceipt = async (source: 'camera' | 'library') => {
    setErrorMsg(null);

    const permissionResult = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      setErrorMsg(
        source === 'camera'
          ? 'Necesitas dar permiso de cámara para fotografiar el recibo.'
          : 'Necesitas dar permiso a tus fotos para elegir el recibo.'
      );
      return;
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      cameraType: ImagePicker.CameraType.back,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    setIsProcessingReceipt(true);
    setIsLoading(true);
    try {
      const parsed = await aiProvider.parseReceiptImage(
        asset.base64!,
        asset.mimeType || 'image/jpeg',
        accounts,
        categories
      );

      if (!parsed.amount) {
        setErrorMsg('No se pudo leer el recibo con claridad. Intenta con mejor luz o completa el formulario manualmente.');
        setMode('manual');
        return;
      }

      applyParsedResult(parsed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al analizar la foto del recibo.');
    } finally {
      setIsProcessingReceipt(false);
      setIsLoading(false);
    }
  };

  // Resuelve la jerarquía Padre/Subcategoría a partir de un categoryId plano
  const applyCategoryId = (categoryId: string | null) => {
    if (!categoryId) {
      setSelectedParentCategoryId('');
      setSelectedSubCategoryId('');
      return;
    }
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    if (cat.parentCategoryId) {
      setSelectedParentCategoryId(cat.parentCategoryId);
      setSelectedSubCategoryId(cat.id);
    } else {
      setSelectedParentCategoryId(cat.id);
      setSelectedSubCategoryId('');
    }
  };

  // Atajo: repetir la última transacción registrada
  const handleRepeatLast = () => {
    const tx = suggestions?.lastTransaction;
    if (!tx) return;
    setType(tx.type);
    setAmount(String(tx.amount));
    setAccountId(tx.accountId);
    setDescription(tx.description || '');
    setMerchantName(tx.merchantName || '');
    setTransferToAccountId(tx.transferToAccountId || '');
    applyCategoryId(tx.categoryId);
    setSuggestedCategoryId(tx.categoryId);
    setMode('manual');
  };

  // Atajo: elegir un comercio reciente autocompleta también su categoría — una regla ya
  // aprendida de una corrección previa le gana a la simple frecuencia histórica.
  const handleSelectMerchant = (merchant: string) => {
    setMerchantName(merchant);
    const ruleCategoryId = matchRuleUseCase.execute(merchant, categorizationRules);
    const finalCategoryId = ruleCategoryId || suggestions?.topCategoryByMerchant[merchant.toLowerCase()] || null;
    if (finalCategoryId) {
      applyCategoryId(finalCategoryId);
      setSuggestedCategoryId(finalCategoryId);
    }
  };

  // Tras guardar un gasto: presupuesto (umbral + ritmo de agotamiento), gasto atípico
  // y riesgo de liquidez a fin de mes. Todo envuelto en try/catch propios — nunca debe
  // bloquear el guardado si una de estas comprobaciones falla.
  const runPostSaveInsights = async (savedTx: Transaction) => {
    if (savedTx.type !== 'expense') return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const daysElapsedInMonth = now.getDate();
    const daysRemainingInMonth = Math.max(0, lastDayOfMonth - daysElapsedInMonth);
    const todayStr = now.toISOString().split('T')[0];
    const categoryName = categories.find(c => c.id === savedTx.categoryId)?.name || 'esta categoría';

    if (savedTx.categoryId) {
      try {
        const monthBudgets = await budgetRepo.getByMonth(year, month + 1);
        const budget = monthBudgets.find(b => b.categoryId === savedTx.categoryId);
        if (budget) {
          const progressAfter = await new CalculateBudgetProgress(transactionRepo).execute(budget);
          await BudgetAlertService.checkAndAlert(progressAfter, categoryName, savedTx);

          if (progressAfter.status !== 'exceeded') {
            const exhaustionUseCase = new ProjectBudgetExhaustion();
            const exhaustionAfter = exhaustionUseCase.execute(progressAfter, daysElapsedInMonth, daysRemainingInMonth);

            if (exhaustionAfter.willExceedBeforeMonthEnd && exhaustionAfter.daysUntilExceeded) {
              // Solo alertar si ESTA transacción fue la que hizo cruzar la proyección a "se agotará"
              const progressBefore = {
                ...progressAfter,
                spent: progressAfter.spent - savedTx.amount,
                remaining: progressAfter.remaining + savedTx.amount,
              };
              const exhaustionBefore = exhaustionUseCase.execute(progressBefore, daysElapsedInMonth, daysRemainingInMonth);
              if (!exhaustionBefore.willExceedBeforeMonthEnd) {
                await BudgetAlertService.alertBudgetPace(categoryName, exhaustionAfter.daysUntilExceeded);
              }
            }
          }
        }
      } catch {
        // Las alertas de presupuesto son un extra; nunca deben bloquear el guardado.
      }

      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const historicalTx = await transactionRepo.getAll({
          categoryId: savedTx.categoryId,
          type: 'expense',
          status: 'confirmed',
          startDate: ninetyDaysAgo.toISOString().split('T')[0],
          endDate: todayStr,
        });
        const atypical = new DetectAtypicalExpense().execute(savedTx.amount, savedTx.categoryId, historicalTx);
        if (atypical.isAtypical) {
          await BudgetAlertService.alertAtypicalExpense(atypical, categoryName);
        }
      } catch {
        // No bloquea el guardado.
      }
    }

    try {
      const allAccounts = await accountRepo.getAll();
      const activeAccounts = allAccounts.filter(a => a.isActive);
      const liquidAccounts = activeAccounts.filter(a => ['cash', 'bank', 'investment'].includes(a.type));
      const cardAccounts = activeAccounts.filter(a => a.type === 'credit_card');

      const balanceUseCase = new CalculateAccountBalance(transactionRepo);
      const liquidSum = (await Promise.all(liquidAccounts.map(a => balanceUseCase.execute(a))))
        .reduce((sum, b) => sum + b, 0);
      const cardsSum = (await Promise.all(cardAccounts.map(a => balanceUseCase.execute(a))))
        .reduce((sum, b) => sum + Math.abs(b), 0);
      const liquidBalanceAfter = liquidSum - cardsSum;

      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const transactionsThisMonth = await transactionRepo.getAll({
        startDate: startOfMonth,
        endDate: todayStr,
        status: 'confirmed',
      });
      const activeRules = await recurringRuleRepo.getAllActive();

      const runwayUseCase = new ProjectMonthlyRunway();
      const projectionAfter = runwayUseCase.execute(liquidBalanceAfter, transactionsThisMonth, activeRules, todayStr);

      if (projectionAfter.isAtRisk) {
        // Solo alertar si ESTA transacción fue la que hizo cruzar el riesgo, no en cada gasto siguiente
        const transactionsBeforeThis = transactionsThisMonth.filter(t => t.id !== savedTx.id);
        const liquidBalanceBefore = liquidBalanceAfter + savedTx.amount;
        const projectionBefore = runwayUseCase.execute(liquidBalanceBefore, transactionsBeforeThis, activeRules, todayStr);
        if (!projectionBefore.isAtRisk) {
          await BudgetAlertService.alertRunwayAtRisk(projectionAfter);
        }
      }
    } catch {
      // No bloquea el guardado.
    }
  };

  // Guardar
  const handleSaveTransaction = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    // Si es gasto, la categoría final es la subcategoría si existe, si no, la categoría principal
    let finalCategoryId = null;
    if (type === 'expense') {
      finalCategoryId = selectedSubCategoryId || selectedParentCategoryId || null;
    } else if (type === 'income') {
      // Auto-asociar la categoría de ingreso disponible
      const defaultIncomeCat = incomeCategories.length > 0 ? incomeCategories[0].id : null;
      finalCategoryId = defaultIncomeCat;
    }

    // Valores por defecto en Modo Rápido (Modo Simple)
    let finalAccountId = accountId;
    let finalDescription = description.trim();
    let finalType = type;
    if (mode === 'quick' && !isEditing) {
      finalType = 'expense';
      if (!finalAccountId && accounts.length > 0) {
        finalAccountId = accounts[0].id;
      }
      if (!finalDescription) {
        const catName = categories.find(c => c.id === finalCategoryId)?.name || 'Gasto';
        finalDescription = `Gasto de ${catName}`;
      }
    }

    // Conversión de moneda (USD -> COP)
    let finalAmountValue = parseFloat(amount) || 0;
    if (purchaseCurrency === 'USD' && !isEditing) {
      const rate = parseFloat(exchangeRate) || 4000;
      finalAmountValue = Math.round(finalAmountValue * rate);
      const originalText = `(USD ${parseFloat(amount).toFixed(2)} @ ${Math.round(rate).toLocaleString('es-CO')})`;
      finalDescription = finalDescription
        ? `${finalDescription} ${originalText}`
        : `Compra en dólares ${originalText}`;
    }

    if (isInstallments && !isEditing) {
      const countVal = parseInt(installmentsCount) || 12;
      const monthlyVal = Math.round(finalAmountValue / countVal);
      const installmentSuffix = `(Diferido a ${countVal} cuotas de $${monthlyVal.toLocaleString('es-CO')})`;
      finalDescription = finalDescription
        ? `${finalDescription} ${installmentSuffix}`
        : `Gasto diferido ${installmentSuffix}`;
    }

    const totalVal = finalAmountValue;
    const countVal = parseInt(installmentsCount) || 12;
    const monthlyVal = Math.round(totalVal / countVal);
    const installmentsMeta = {
      totalAmount: totalVal,
      count: countVal,
      monthlyAmount: monthlyVal,
      startDate: transactionDate,
    };

    const initialAiMetadata = isEditing && originalTx?.aiMetadata ? {
      ...originalTx.aiMetadata,
      ...(aiPreviewData && {
        rawInput: aiInput,
        parsedAmount: aiPreviewData.amount,
        parsedCategory: aiPreviewData.suggestedCategoryName,
        parsedAccount: aiPreviewData.suggestedAccountName,
        parsedMerchant: aiPreviewData.merchantName,
        confidence: aiPreviewData.confidence || 1,
      })
    } : (aiPreviewData ? {
      rawInput: aiInput,
      parsedAmount: aiPreviewData.amount,
      parsedCategory: aiPreviewData.suggestedCategoryName,
      parsedAccount: aiPreviewData.suggestedAccountName,
      parsedMerchant: aiPreviewData.merchantName,
      confidence: aiPreviewData.confidence || 1,
      corrections: {},
    } : {});

    const finalAiMetadata = isInstallments && !isEditing
      ? { ...initialAiMetadata, installments: installmentsMeta }
      : (Object.keys(initialAiMetadata).length > 0 ? initialAiMetadata : null);

    const inputData = {
      accountId: finalAccountId,
      categoryId: finalCategoryId,
      type: finalType,
      amount: finalAmountValue,
      description: finalDescription,
      merchantName: type === 'expense' ? merchantName : null,
      transactionDate,
      transferToAccountId: type === 'transfer' ? transferToAccountId : null,
      status: 'confirmed',
      // Nunca confiar ciegamente en el estado local: solo se envía true si de verdad
      // aplica hoy (cuenta propia, no transferencia). La base de datos también lo valida.
      isPrivate: canBePrivate ? isPrivate : false,
      inputMethod: isEditing
        ? (originalTx?.inputMethod || 'manual')
        : aiPreviewData
          ? (aiPreviewData.rawInput === '[foto de recibo]' ? ('photo' as const) : ('nlq' as const))
          : ('manual' as const),
      aiMetadata: finalAiMetadata,
      ...(isEditing && originalTx && {
        isRecurringInstance: originalTx.isRecurringInstance,
        recurringRuleId: originalTx.recurringRuleId,
      })
    };

    const validation = validator.execute(inputData, accounts);
    if (!validation.isValid) {
      setErrorMsg(validation.errors.join(' '));
      setIsLoading(false);
      return;
    }

    try {
      const savedTx = isEditing && id
        ? await transactionRepo.update(id, inputData as any)
        : await transactionRepo.create(inputData);

      // Feedback táctil de éxito al guardar
      hapticSuccess();

      // Si el usuario cambió la categoría que la IA/una regla habían sugerido,
      // se recuerda la corrección para no repetir el mismo error con este comercio.
      if (type === 'expense' && merchantName.trim() && finalCategoryId && finalCategoryId !== suggestedCategoryId) {
        try {
          await learnCategorizationUseCase.execute({
            merchantName,
            correctedCategoryId: finalCategoryId,
            existingRules: categorizationRules,
          });
        } catch {
          // No bloquea el guardado si esto falla; es puramente un aprendizaje adicional.
        }
      }

      try {
        await runPostSaveInsights(savedTx);
        const { RegistrationReminderService } = require('@/src/infrastructure/services/RegistrationReminderService');
        RegistrationReminderService.scheduleInactivityReminder(2).catch(() => {});
      } catch {
        // Las alertas predictivas son un extra; nunca deben bloquear el guardado.
      }

      // Evaluador de Micro-Celebraciones (Inversión, Ahorro o Racha)
      let celebrationToTrigger: {
        type: CelebrationType;
        title: string;
        description: string;
        badgeText?: string;
        amountFormatted?: string;
      } | null = null;

      // 1. Celebración al Ahorrar / Invertir
      if (type === 'transfer' && transferToAccountId) {
        const targetAcc = accounts.find((a) => a.id === transferToAccountId);
        if (targetAcc?.type === 'investment') {
          celebrationToTrigger = {
            type: 'investment',
            badgeText: '🚀 ¡Ahorro / Inversión!',
            title: '¡Haciendo Crecer tu Capital!',
            amountFormatted: `$${Math.abs(Math.round(savedTx.amount)).toLocaleString('es-CO')}`,
            description: '¡Excelente decisión! Has destinado capital directamente a tu cuenta de inversión.',
          };
        }
      } else if (type === 'expense' && finalCategoryId) {
        const selectedCat = categories.find((c) => c.id === finalCategoryId);
        if (
          selectedCat?.budgetRole === 'savings' ||
          selectedCat?.name.toLowerCase().includes('ahorro') ||
          selectedCat?.name.toLowerCase().includes('invers')
        ) {
          celebrationToTrigger = {
            type: 'investment',
            badgeText: '🎯 ¡Aporte a Ahorro!',
            title: '¡Fortaleciendo tus Reservas!',
            amountFormatted: `$${Math.abs(Math.round(savedTx.amount)).toLocaleString('es-CO')}`,
            description: '¡Muy bien! Este movimiento fue directo a tus reservas de Ahorro e Inversión.',
          };
        }
      }

      // 2. Celebración de Racha (Hitos de 3, 7, 14, 21, 30 días)
      if (!celebrationToTrigger) {
        try {
          const ownTx = historicTxsRef.current.filter((tx) => tx.createdByUserId === userProfile?.id);
          const dates = ownTx.map((tx) => tx.transactionDate);
          if (!dates.includes(transactionDate)) dates.push(transactionDate);
          const newStreak = new CalculateRegistrationStreak().execute(dates, transactionDate);

          const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 100, 365];
          if (STREAK_MILESTONES.includes(newStreak)) {
            celebrationToTrigger = {
              type: 'streak',
              badgeText: `🔥 ¡Racha de ${newStreak} Días!`,
              title: '¡Hábito Financiero Firme!',
              description: `¡Felicidades! Has mantenido tu disciplina registrando movimientos durante ${newStreak} días seguidos.`,
            };
          }
        } catch {
          // No interrumpe si falla
        }
      }

      if (celebrationToTrigger) {
        setCelebrationConfig({
          visible: true,
          ...celebrationToTrigger,
        });
      } else {
        navigateAway();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el movimiento.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateAway = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/transactions');
    }
  };

  // Eliminar
  const handleDeleteTransaction = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      await transactionRepo.delete(id);
      router.replace('/(tabs)/transactions');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar el movimiento.');
      setIsLoading(false);
    }
  };

  if (isLoading && !isListening && amount === '' && accounts.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <NetworkStatusBar />
      <View style={[
        styles.header, 
        { 
          backgroundColor: theme.colors.surface, 
          borderBottomColor: theme.colors.outline,
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 10)
        }
      ]}>
        <IconButton icon="chevron-left" size={24} onPress={() => router.back()} />
        <Text style={[styles.headerTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
          {isEditing ? 'Editar Movimiento' : 'Registrar Movimiento'}
        </Text>
        {isEditing ? (
          <IconButton icon="trash-can-outline" iconColor={theme.colors.error} size={22} onPress={handleDeleteTransaction} />
        ) : (
          <IconButton icon="history" size={24} iconColor={theme.colors.primary} onPress={() => router.push('/transactions')} />
        )}
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: Math.max(insets.bottom + 24, 24) }]} 
        keyboardShouldPersistTaps="handled"
      >

        {!isEditing && (
          <SegmentedButtons
            value={mode}
            onValueChange={(val) => setMode(val as 'quick' | 'ai' | 'manual')}
            buttons={[
              { value: 'quick', label: 'Simple', icon: 'baby-face-outline', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
              { value: 'ai', label: 'Voz / IA', icon: 'robot', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
              { value: 'manual', label: 'Detallado', icon: 'form-select', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
            ]}
            style={styles.modeSelector}
          />
        )}

        <HelperText type="error" visible={!!errorMsg} style={styles.errorText}>
          {errorMsg}
        </HelperText>

        {/* ─── VISTA: MODO SIMPLE ────────────────────────────────────────── */}
        {mode === 'quick' && !isEditing && (
          <View style={styles.quickSection}>
            <Text style={[styles.quickTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
              ¿Cuánto gastaste?
            </Text>
            
            {/* Display de Monto (Tocar para abrir el teclado flotante) */}
            <Pressable onPress={() => setIsNumpadVisible(true)}>
              <Surface style={[styles.quickAmountDisplay, theme.shadows.sm, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
                <Text style={[theme.typography.amountLarge, { color: theme.colors.primary, textAlign: 'center' }]}>
                  $ {/[+\-×÷]/.test(amount) ? amount : (parseFloat(amount || '0') || 0).toLocaleString('es-CO')}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                  Toca para cambiar monto
                </Text>
              </Surface>
            </Pressable>

            {/* Teclado de Botones Rápidos (ScrollView Horizontal para encajar en cualquier pantalla móvil) */}
            <View style={{ marginBottom: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipsRow}>
                {[2000, 5000, 10000, 20000, 50000].map(val => (
                  <Button
                    key={val}
                    mode="outlined"
                    compact
                    style={styles.quickChip}
                    onPress={() => {
                      const current = parseFloat(amount || '0') || 0;
                      setAmount(String(current + val));
                      setErrorMsg(null);
                    }}
                  >
                    +{val / 1000}k
                  </Button>
                ))}
                <Button
                  mode="outlined"
                  compact
                  textColor={theme.colors.error}
                  style={[styles.quickChip, { borderColor: theme.colors.error }]}
                  onPress={() => {
                    setAmount('');
                  }}
                >
                  Borrar
                </Button>
              </ScrollView>
            </View>

            <Text style={[styles.quickTitle, theme.typography.h3, { color: theme.colors.onSurface, marginTop: 24 }]}>
              ¿En qué lo gastaste?
            </Text>

            {/* Grid 4x2 de Categorías con Vector Icons y Badge Checkmark ✓ */}
            <View style={styles.categoryGrid}>
              {[
                { label: 'Comida', icon: 'silverware-fork-knife', keywords: ['comida', 'alimentación', 'mercado', 'restaurante'] },
                { label: 'Casa', icon: 'home-variant-outline', keywords: ['vivienda', 'hogar', 'arriendo', 'casa', 'servicios públicos'] },
                { label: 'Transporte', icon: 'bus-clock', keywords: ['transporte', 'car', 'bus', 'taxi', 'uber', 'gasolina'] },
                { label: 'Salud', icon: 'medical-bag', keywords: ['salud', 'bienestar', 'médico', 'hospital', 'farmacia'] },
                { label: 'Ocio', icon: 'controller-classic-outline', keywords: ['entretenimiento', 'juegos', 'suscripciones', 'cine', 'ocio'] },
                { label: 'Estudio', icon: 'school-outline', keywords: ['educación', 'escuela', 'libros', 'curso'] },
                { label: 'Finanzas', icon: 'shield-check-outline', keywords: ['finanzas', 'seguros', 'banco', 'impuestos', 'deuda'] },
                { label: 'Sin clasificar', icon: 'help-circle-outline', keywords: ['sin clasificar', 'otros', 'varios', 'compras', 'regalos'] }
              ].map(item => {
                const matchedCategory = categories.find(c => 
                  c.name.toLowerCase().includes(item.label.toLowerCase()) ||
                  item.keywords.some(k => c.name.toLowerCase().includes(k))
                );
                
                const isSelected = matchedCategory ? (selectedParentCategoryId === matchedCategory.id || selectedSubCategoryId === matchedCategory.id) : false;

                return (
                  <Pressable
                    key={item.label}
                    style={[
                      styles.categoryCard,
                      theme.shadows.sm,
                      {
                        backgroundColor: isSelected ? theme.colors.primaryContainer + '40' : theme.colors.surface,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                        borderWidth: isSelected ? 2 : 1,
                        position: 'relative',
                      }
                    ]}
                    onPress={() => {
                      if (matchedCategory) {
                        applyCategoryId(matchedCategory.id);
                        setErrorMsg(null);
                      }
                    }}
                  >
                    {/* Badge Checkmark ✓ en la esquina superior derecha */}
                    {isSelected && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: theme.colors.primary,
                          justifyContent: 'center',
                          alignItems: 'center',
                          zIndex: 2,
                        }}
                      >
                        <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                      </View>
                    )}

                    <View style={[
                      styles.iconCircle,
                      { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceVariant }
                    ]}>
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={22}
                        color={isSelected ? theme.colors.onPrimary : theme.colors.primary}
                      />
                    </View>
                    <Text
                      style={[
                        theme.typography.caption,
                        {
                          color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                          textAlign: 'center',
                          marginTop: 4
                        }
                      ]}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── VISTA: ASISTENTE IA ────────────────────────────────────────── */}
        {/* ─── VISTA: ASISTENTE IA (Cámara OCR + Dictado por Voz) ──────────────── */}
        {mode === 'ai' && !isEditing && (
          <View style={styles.aiSection}>
            <Text style={[styles.aiTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
              ¿Cómo quieres registrar tu gasto?
            </Text>
            <Text style={[styles.aiSubtitle, theme.typography.bodySmall, { color: theme.customColors.textSecondary, marginBottom: 16 }]}>
              Usa la inteligencia artificial para escanear tu factura o dictar por voz
            </Text>

            {/* Tarjetas Principales de Ingreso de IA (Cámara OCR + Galería arriba de todo) */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              {/* Tarjeta 1: Escanear Factura (Cámara OCR) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePickReceipt('camera')}
                disabled={isLoading || isProcessingReceipt}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.primaryContainer + '40',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isProcessingReceipt ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
                ) : (
                  <>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: theme.colors.primary,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <MaterialCommunityIcons name="camera-plus" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.primary, textAlign: 'center' }]}>
                      Escanear Factura
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, textAlign: 'center', marginTop: 2, fontSize: 11 }]}>
                      Tomar foto con IA
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Tarjeta 2: Subir de Galería */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePickReceipt('library')}
                disabled={isLoading || isProcessingReceipt}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1.5,
                  borderColor: theme.colors.outline + '60',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isProcessingReceipt ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
                ) : (
                  <>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: theme.colors.surfaceVariant,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <MaterialCommunityIcons name="image-multiple" size={24} color={theme.colors.primary} />
                    </View>
                    <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface, textAlign: 'center' }]}>
                      Elegir de Galería
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, textAlign: 'center', marginTop: 2, fontSize: 11 }]}>
                      Subir foto existente
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Separador elegante para Dictado por Voz */}
            <View style={styles.receiptDividerRow}>
              <Divider style={{ flex: 1 }} />
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginHorizontal: 12, fontWeight: '600' }]}>
                o dicta / escribe con tu voz
              </Text>
              <Divider style={{ flex: 1 }} />
            </View>

            {/* Sección de Dictado por Voz y Entrada de Texto */}
            <View style={{ marginVertical: 14, alignItems: 'center' }}>
              <VoicePulseWave
                isListening={isListening}
                onPress={handleMicPress}
              />
              <Text
                style={[
                  theme.typography.caption,
                  {
                    marginTop: 12,
                    color: isListening ? theme.colors.error : theme.customColors.textSecondary,
                    fontWeight: isListening ? '700' : '500',
                  },
                ]}
              >
                {isListening ? '🎙️ Escuchando tu voz...' : 'Toca el micrófono para dictar'}
              </Text>
            </View>

            <TextInput
              label="Comando de voz/texto"
              placeholder="Ej: gasté 50 mil pesos en empanadas con la de Bancolombia"
              value={aiInput}
              onChangeText={(txt) => { setAiInput(txt); setErrorMsg(null); }}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.aiInput}
              disabled={isLoading}
            />

            <Button
              mode="contained"
              onPress={handleProcessAI}
              loading={isLoading}
              disabled={isLoading || !aiInput.trim()}
              style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
            >
              Procesar con IA
            </Button>
          </View>
        )}

        {/* ─── VISTA: FORMULARIO MANUAL REDISEÑADO SEGÚN MOCKUP ──────────── */}
        {mode === 'manual' && (
          <View style={styles.formSection}>
            {/* Opción sutil de Repetir último movimiento (Solo en Detallado, evita layout shift) */}
            {!isEditing && suggestions?.lastTransaction && (
              <Pressable onPress={handleRepeatLast} disabled={isLoading} style={{ marginBottom: 14 }}>
                <Surface style={[styles.repeatCard, theme.shadows.sm, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
                  <MaterialCommunityIcons name="history" size={20} color={theme.colors.primary} />
                  <View style={styles.repeatCardText}>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
                      Repetir el último movimiento
                    </Text>
                    <Text style={[theme.typography.body, { color: theme.colors.onSurface, fontWeight: '600', fontSize: 13 }]} numberOfLines={1}>
                      {suggestions.lastTransaction.merchantName || suggestions.lastTransaction.description || 'Sin comercio'}
                      {'  ·  $'}
                      {Number(suggestions.lastTransaction.amount).toLocaleString('es-CO')}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.customColors.textSecondary} />
                </Surface>
              </Pressable>
            )}

            {/* 1. Selector de Tipo (Gasto / Ingreso / Transferencia) */}
            <SegmentedButtons
              value={type}
              onValueChange={(val) => {
                setType(val as any);
                setSelectedParentCategoryId('');
                setSelectedSubCategoryId('');
              }}
              buttons={[
                { value: 'expense', label: 'Gasto', icon: 'arrow-up-circle', disabled: isLoading, checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                { value: 'income', label: 'Ingreso', icon: 'arrow-down-circle', disabled: isLoading, checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                { value: 'transfer', label: 'Transferencia', icon: 'swap-horizontal', disabled: isLoading, checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
              ]}
              style={styles.typeSelector}
            />

            {/* 2. Tarjeta Principal de Monto y Selector de Moneda (COP / USD Pill Integrado) */}
            <Surface style={[styles.quickAmountDisplay, theme.shadows.sm, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Pill de Moneda sutil de 1 toque (Sin banderas ni redundancia) */}
                {!isEditing && type === 'expense' && (
                  <Pressable
                    onPress={() => setPurchaseCurrency(prev => prev === 'COP' ? 'USD' : 'COP')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.colors.surface,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: theme.colors.outline + '60',
                      gap: 4,
                    }}
                  >
                    <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
                      {purchaseCurrency}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={16} color={theme.customColors.textSecondary} />
                  </Pressable>
                )}

                {/* Display del Monto en el centro/derecha */}
                <Pressable onPress={() => setIsNumpadVisible(true)} style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[theme.typography.amountLarge, { color: theme.colors.primary }]}>
                    $ {/[+\-×÷]/.test(amount) ? amount : (parseFloat(amount || '0') || 0).toLocaleString('es-CO')}
                  </Text>
                </Pressable>

                {/* Lápiz de edición */}
                <IconButton
                  icon="pencil-outline"
                  size={20}
                  iconColor={theme.customColors.textSecondary}
                  onPress={() => setIsNumpadVisible(true)}
                  style={{ margin: 0, marginLeft: 8 }}
                />
              </View>
            </Surface>

            {/* Tasa de cambio cuando la divisa es USD */}
            {!isEditing && type === 'expense' && purchaseCurrency === 'USD' && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <TextInput
                    label="Tasa de Cambio (COP por USD)"
                    value={exchangeRate}
                    onChangeText={txt => {
                      setExchangeRate(txt.replace(/[^0-9.]/g, ''));
                      setErrorMsg(null);
                    }}
                    mode="outlined"
                    keyboardType="numeric"
                    style={{ flex: 1 }}
                    disabled={isLoading || loadingRate}
                    right={loadingRate ? <TextInput.Icon icon={() => <ActivityIndicator size="small" color={theme.colors.primary} />} /> : null}
                  />
                  <IconButton
                    icon="autorenew"
                    size={24}
                    iconColor={theme.colors.primary}
                    disabled={loadingRate || isLoading}
                    onPress={fetchRate}
                    style={{ margin: 0, marginTop: 6 }}
                  />
                </View>
                
                <Surface style={{ padding: 10, borderRadius: 10, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.outline, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Total Equivalente en COP</Text>
                  <Text style={[theme.typography.body, { fontWeight: 'bold', color: theme.colors.primary }]}>
                    $ {Math.round((parseFloat(amount || '0') || 0) * (parseFloat(exchangeRate || '0') || 0)).toLocaleString('es-CO')}
                  </Text>
                </Surface>
              </View>
            )}

            {/* 3. Fila Doble 50% / 50%: Cuenta (Izquierda) + Categoría (Derecha) */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {/* Tarjeta Cuenta Origen (50% en gasto/ingreso, 50% en transferencia) */}
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
                  {type === 'transfer' ? 'Cuenta Origen' : 'Cuenta'}
                </Text>
                {(() => {
                  const selAcc = accounts.find(a => a.id === accountId);
                  const brand = selAcc ? getAccountBrandInfo(selAcc) : null;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setAccountSelectorTarget('origin');
                        setIsAccountSheetVisible(true);
                      }}
                      disabled={isLoading}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: selAcc ? theme.colors.primary : theme.colors.outline,
                        backgroundColor: theme.colors.surface,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 4 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: brand?.color || theme.colors.primaryContainer,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 8,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={(brand?.icon as any) || 'bank-outline'}
                            size={18}
                            color="#FFFFFF"
                          />
                        </View>
                        <Text
                          style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}
                          numberOfLines={1}
                        >
                          {selAcc ? selAcc.name : 'Seleccionar'}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={20} color={theme.customColors.textSecondary} />
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* En Transferencia: Cuenta Destino (50% derecha para simetría total con Origen) */}
              {type === 'transfer' && (
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.customColors.transfer, marginBottom: 4, fontWeight: '600' }]}>
                    Cuenta Destino
                  </Text>
                  {(() => {
                    const selTargetAcc = accounts.find(a => a.id === transferToAccountId);
                    const brandTarget = selTargetAcc ? getAccountBrandInfo(selTargetAcc) : null;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setAccountSelectorTarget('destination');
                          setIsAccountSheetVisible(true);
                        }}
                        disabled={isLoading}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 10,
                          paddingVertical: 10,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: selTargetAcc ? theme.customColors.transfer : theme.colors.outline,
                          backgroundColor: theme.colors.surface,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 4 }}>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: brandTarget?.color || theme.colors.primaryContainer,
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 8,
                            }}
                          >
                            <MaterialCommunityIcons
                              name={(brandTarget?.icon as any) || 'bank-outline'}
                              size={18}
                              color="#FFFFFF"
                            />
                          </View>
                          <Text
                            style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}
                            numberOfLines={1}
                          >
                            {selTargetAcc ? selTargetAcc.name : 'Seleccionar'}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={theme.customColors.textSecondary} />
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              )}

              {/* Tarjeta Categoría (50%) - Solo para gastos */}
              {type === 'expense' && (
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
                    Categoría
                  </Text>
                  {(() => {
                    const selectedCatId = selectedSubCategoryId || selectedParentCategoryId;
                    const selectedCatObj = categories.find((c) => c.id === selectedCatId);
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setIsCategorySheetVisible(true)}
                        disabled={isLoading}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 10,
                          paddingVertical: 10,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: selectedCatObj ? theme.colors.primary : theme.colors.outline,
                          backgroundColor: theme.colors.surface,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 4 }}>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: selectedCatObj?.color ? selectedCatObj.color + '20' : theme.colors.primaryContainer,
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 8,
                            }}
                          >
                            <MaterialCommunityIcons
                              name={(selectedCatObj?.icon as any) || 'tag-outline'}
                              size={18}
                              color={selectedCatObj?.color || theme.colors.primary}
                            />
                          </View>
                          <Text
                            style={[theme.typography.caption, { fontWeight: selectedCatObj ? '700' : '500', color: theme.colors.onSurface }]}
                            numberOfLines={1}
                          >
                            {selectedCatObj ? selectedCatObj.name : 'Categoría'}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={theme.customColors.textSecondary} />
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              )}
            </View>

            {/* Live Budget Meter (Micro-Feedback en Tiempo Real de Presupuesto) */}
            {type === 'expense' && (() => {
              const activeCatId = selectedSubCategoryId || selectedParentCategoryId;
              const activeCatObj = categories.find((c) => c.id === activeCatId);
              let budgetInfo = activeCatId ? budgetSpentMap[activeCatId] : undefined;
              if (!budgetInfo && activeCatObj?.parentCategoryId) {
                budgetInfo = budgetSpentMap[activeCatObj.parentCategoryId];
              }

              // Limpiar puntos de miles (ej "8.500" -> "8500") para parsear numéricamente de forma correcta
              const cleanAmountStr = String(amount).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
              const numAmount = parseFloat(cleanAmountStr) || 0;

              if (activeCatObj && budgetInfo) {
                return (
                  <View style={{ marginBottom: 16 }}>
                    <LiveBudgetMeter
                      categoryName={activeCatObj.name}
                      budgetLimit={budgetInfo.limit}
                      currentSpent={budgetInfo.spent}
                      newExpenseAmount={numAmount}
                      currency={purchaseCurrency}
                    />
                  </View>
                );
              }
              return null;
            })()}

            {/* 4. Sección Comercio / Establecimiento + Chips Recientes (Limpio, sin íconos recargados) */}
            {type === 'expense' && (
              <View style={{ marginBottom: 16 }}>
                <TextInput
                  label="Comercio / Establecimiento"
                  placeholder="Escribe el nombre del comercio"
                  value={merchantName}
                  onChangeText={(text) => {
                    setMerchantName(text);
                    handlePredictiveCategorization(text);
                  }}
                  mode="outlined"
                  style={{ marginBottom: 8 }}
                  disabled={isLoading}
                />

                {/* Recientes (Chips de texto sutiles sin íconos redundantes) */}
                {!!suggestions?.recentMerchantsByAccount[accountId]?.length && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 6, fontWeight: '600' }]}>
                      Recientes:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {suggestions.recentMerchantsByAccount[accountId].map(merchant => (
                        <Pressable
                          key={merchant}
                          onPress={() => handleSelectMerchant(merchant)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 12,
                            backgroundColor: merchantName.toLowerCase() === merchant.toLowerCase() ? theme.colors.primaryContainer : theme.colors.surface,
                            borderWidth: 1,
                            borderColor: merchantName.toLowerCase() === merchant.toLowerCase() ? theme.colors.primary : theme.colors.outline + '40',
                          }}
                        >
                          <Text style={[theme.typography.caption, { fontWeight: merchantName.toLowerCase() === merchant.toLowerCase() ? '700' : '500', color: theme.colors.onSurface }]}>
                            {merchant}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* 5. Tarjeta Agrupada: Detalles opcionales (Fecha, Notas, Transacción Privada - Colapsable) */}
            <Surface style={[theme.shadows.sm, { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.outline + '40', marginBottom: 16 }]}>
              <Pressable
                onPress={() => setIsOptionalDetailsExpanded(!isOptionalDetailsExpanded)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="tune-variant" size={18} color={theme.colors.primary} />
                  <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                    Detalles opcionales
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={isOptionalDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.customColors.textSecondary}
                />
              </Pressable>

              {isOptionalDetailsExpanded && (
                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.outline + '20' }}>
                  {/* Fila Fecha */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.outline + '20' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="calendar-month-outline" size={18} color={theme.colors.primary} />
                      </View>
                      <Text style={[theme.typography.caption, { color: theme.colors.onSurface, fontWeight: '600' }]}>Fecha</Text>
                    </View>

                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        style={{ ...webStyles.dateInput, paddingVertical: 4, paddingHorizontal: 8, fontSize: 13 }}
                        disabled={isLoading}
                      />
                    ) : (
                      <Pressable onPress={() => setShowDatePicker(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
                          {transactionDate}
                        </Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.customColors.textSecondary} />
                      </Pressable>
                    )}
                  </View>

                  {/* Fila Notas / Descripción */}
                  <View style={{ paddingVertical: 8, borderBottomWidth: canBePrivate ? 1 : 0, borderBottomColor: theme.colors.outline + '20' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="comment-text-outline" size={18} color={theme.colors.primary} />
                      </View>
                      <Text style={[theme.typography.caption, { color: theme.colors.onSurface, fontWeight: '600' }]}>Notas</Text>
                    </View>
                    <TextInput
                      placeholder="Añadir nota opcional"
                      value={description}
                      onChangeText={(text) => {
                        setDescription(text);
                        handlePredictiveCategorization(text);
                      }}
                      mode="outlined"
                      dense
                      style={{ backgroundColor: theme.colors.background }}
                      disabled={isLoading}
                    />
                  </View>

                  {/* Fila Ocultar del resto de la familia (Privado) */}
                  {canBePrivate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="eye-off-outline" size={18} color={theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[theme.typography.caption, { color: theme.colors.onSurface, fontWeight: '600' }]}>
                            Ocultar del resto de la familia
                          </Text>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
                            Solo tú podrás ver este movimiento
                          </Text>
                        </View>
                      </View>
                      <Switch value={isPrivate} onValueChange={setIsPrivate} disabled={isLoading} color={theme.colors.primary} />
                    </View>
                  )}
                </View>
              )}
            </Surface>

          </View>
        )}
      </ScrollView>

      {/* Barra Flotante Inferior de Acción Principal (Sticky Bottom Bar Exclusiva) */}
      <Surface
        style={[
          styles.stickyBottomBar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.outline,
            paddingBottom: Math.max(insets.bottom + 8, 12),
          },
        ]}
        elevation={4}
      >
        <Button
          mode="contained"
          icon="check-circle"
          onPress={handleSaveTransaction}
          loading={isLoading}
          disabled={
            isLoading ||
            !amount ||
            parseFloat(amount) <= 0 ||
            (mode === 'quick' ? !selectedParentCategoryId : !accountId)
          }
          buttonColor={theme.colors.primary}
          textColor="#FFFFFF"
          style={styles.floatingPrimaryBtn}
          labelStyle={{ fontSize: 16, fontWeight: '700', paddingVertical: 2 }}
        >
          {mode === 'quick'
            ? '¡Registrar Gasto!'
            : isEditing
            ? 'Guardar Cambios'
            : 'Confirmar Movimiento'}
        </Button>
      </Surface>

      <NumpadBottomSheet
        visible={isNumpadVisible}
        value={amount}
        onChangeValue={(val) => {
          setAmount(val);
          setErrorMsg(null);
        }}
        onClose={() => setIsNumpadVisible(false)}
      />

      <CategoryBottomSheet
        visible={isCategorySheetVisible}
        categories={categories}
        selectedCategoryId={selectedSubCategoryId || selectedParentCategoryId}
        onSelect={applyCategoryId}
        onClose={() => setIsCategorySheetVisible(false)}
        excludeNamesContaining="ingreso"
      />

      {/* ─── PORTAL: DIÁLOGO SELECTOR DE CUENTAS ──────────────────────────── */}
      <Portal>
        <Dialog
          visible={isAccountSheetVisible}
          onDismiss={() => setIsAccountSheetVisible(false)}
          style={{
            maxHeight: '80%',
            borderRadius: 16,
            maxWidth: Platform.OS === 'web' ? 560 : '100%',
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Dialog.Title>
            {accountSelectorTarget === 'destination' ? 'Seleccionar Cuenta Destino' : 'Seleccionar Cuenta Origen'}
          </Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }}>
              {accounts.map(acc => {
                const brand = getAccountBrandInfo(acc);
                const isSelected = accountSelectorTarget === 'origin' ? accountId === acc.id : transferToAccountId === acc.id;
                const isDisabled = accountSelectorTarget === 'destination' && acc.id === accountId;

                return (
                  <TouchableOpacity
                    key={acc.id}
                    activeOpacity={0.7}
                    disabled={isDisabled}
                    onPress={() => {
                      if (accountSelectorTarget === 'origin') {
                        setAccountId(acc.id);
                      } else {
                        setTransferToAccountId(acc.id);
                      }
                      setIsAccountSheetVisible(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      marginBottom: 6,
                      backgroundColor: isSelected ? theme.colors.primaryContainer + '40' : 'transparent',
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: theme.colors.primary,
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: brand.color,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons name={brand.icon as any} size={20} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[theme.typography.body, { fontWeight: isSelected ? '700' : '500', color: theme.colors.onSurface }]}>
                        {acc.name}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                        {acc.type === 'bank' ? 'Banco' : acc.type === 'cash' ? 'Efectivo' : acc.type === 'credit_card' ? 'Tarjeta de Crédito' : acc.type === 'loan' ? 'Deuda / Préstamo' : 'Inversión'}
                      </Text>
                    </View>
                    {isSelected && <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setIsAccountSheetVisible(false)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Selector nativo de fecha para Android / iOS */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date(transactionDate + 'T00:00:00')}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setTransactionDate(`${year}-${month}-${day}`);
            }
          }}
        />
      )}

      {/* Modal de Micro-Celebraciones (Inversión, Ahorro o Racha) */}
      {celebrationConfig && (
        <MicroCelebrationModal
          visible={celebrationConfig.visible}
          type={celebrationConfig.type}
          title={celebrationConfig.title}
          description={celebrationConfig.description}
          badgeText={celebrationConfig.badgeText}
          amountFormatted={celebrationConfig.amountFormatted}
          onDismiss={() => {
            setCelebrationConfig(null);
            navigateAway();
          }}
        />
      )}
    </KeyboardAvoidingView>
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
  scrollContent: {
    padding: 24,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 680 : '100%',
    alignSelf: 'center',
  },
  modeSelector: {
    marginBottom: 16,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  aiSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  aiTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  aiSubtitle: {
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  micContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 32,
  },
  micButton: {
    borderRadius: 50,
  },
  micButtonContent: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiInput: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
  receiptDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginTop: 20,
  },
  receiptBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 400,
    marginTop: 16,
  },
  receiptBtn: {
    flex: 1,
    borderRadius: 8,
  },
  repeatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  repeatCardText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  formSection: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  typeSelector: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  dateLabel: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  selectLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  accountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  privacyDivider: {
    marginBottom: 16,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  privacyText: {
    flex: 1,
    marginRight: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  selectBtn: {
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  actionBtn: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 4,
  },
  quickSection: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: 8,
  },
  quickTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickAmountDisplay: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  quickChip: {
    borderRadius: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 16,
  },
  categoryCard: {
    width: '23.5%',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stickyBottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  floatingPrimaryBtn: {
    width: '100%',
    borderRadius: 14,
    elevation: 2,
  },
});

const webStyles = StyleSheet.create({
  dateInput: {
    width: '100%',
    height: 48,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
  } as any,
});
