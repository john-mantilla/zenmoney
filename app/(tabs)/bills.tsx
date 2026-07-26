/**
 * ZenMoney — Facturas (Bills)
 *
 * Ofrece una visualización en calendario mensual interactivo de los vencimientos
 * de facturas y obligaciones, permitiendo marcarlas como pagadas en tiempo real
 * y agregar nuevos cobros que llegan en el día a día.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Platform, Dimensions } from 'react-native';
import { AppAlert } from '@/src/presentation/services/AppAlert';
import { Text, Card, Button, Portal, Dialog, TextInput, HelperText, ActivityIndicator, List, Surface, IconButton, Menu, SegmentedButtons } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAppTheme } from '@/src/presentation/theme';
import { AmountDisplay, EmptyState, CategoryPickerMenu, NetworkStatusBar } from '@/src/presentation/components';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { SupabaseRecurringRuleRepository } from '@/src/data/repositories/SupabaseRecurringRuleRepository';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Account } from '@/src/domain/entities/Account';
import { Category } from '@/src/domain/entities/Category';
import { BillAlertService } from '@/src/infrastructure/services/BillAlertService';
import { useRouter, useFocusEffect } from 'expo-router';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const cleanStr = dateStr.split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  return new Date(dateStr);
};

export default function BillsScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  // Estados de datos
  const [bills, setBills] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Estados de carga e interfaz
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  // Estados del calendario y secciones colapsables
  const { selectedYear: currentYear, selectedMonth: currentMonth } = useDateStore();
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isUnpaidExpanded, setIsUnpaidExpanded] = useState(true);
  const [isPaidExpanded, setIsPaidExpanded] = useState(false);

  // Estados del Diálogo para registrar una nueva factura
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [billAmount, setBillAmount] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billAccountId, setBillAccountId] = useState('');
  const [billCategoryId, setBillCategoryId] = useState('');
  const [billDate, setBillDate] = useState('');
  const [savingBill, setSavingBill] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [billType, setBillType] = useState<'expense' | 'transfer'>('expense');
  const [billTransferToAccountId, setBillTransferToAccountId] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [editingBill, setEditingBill] = useState<Transaction | null>(null);

  // Repositorios y caso de uso
  const transactionRepo = new HybridTransactionRepository();
  const accountRepo = new HybridAccountRepository();
  const categoryRepo = new HybridCategoryRepository();
  const recurrenceRepo = new SupabaseRecurringRuleRepository();

  const lastLoadRef = useRef<number>(0);
  const lastLoadedMonthRef = useRef<number | null>(null);
  const lastLoadedYearRef = useRef<number | null>(null);

  const loadData = async (force = false) => {
    const isNewTimeframe = currentMonth !== lastLoadedMonthRef.current || currentYear !== lastLoadedYearRef.current;
    if (!force && !isNewTimeframe && Date.now() - lastLoadRef.current < 5000) {
      return;
    }
    lastLoadRef.current = Date.now();
    lastLoadedMonthRef.current = currentMonth;
    lastLoadedYearRef.current = currentYear;
    try {
      // Las facturas recurrentes ya NO se generan aquí: se crean todas de una sola vez
      // cuando el usuario define la recurrencia (con su fecha de inicio y fin), desde
      // Configuración > Cuentas o Configuración > Recurrencias. Esta pantalla solo lee
      // y muestra lo que ya existe — así una factura editada nunca "reaparece" duplicada.
      const loadedAccounts = await accountRepo.getAll();
      setAccounts(loadedAccounts.filter(a => a.isActive));
      if (loadedAccounts.length > 0 && !billAccountId) {
        setBillAccountId(loadedAccounts[0].id);
      }

      const loadedCats = await categoryRepo.getAll(true);
      setCategories(loadedCats);
      if (loadedCats.length > 0 && !billCategoryId) {
        setBillCategoryId(loadedCats[0].id);
      }

      // Cargar todas las transacciones del mes seleccionado (pendientes y recurrentes)
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const txs = await transactionRepo.getAll({ startDate, endDate });
      
      // Obtener todas las transacciones históricas para consolidar diferidos de tarjetas de crédito
      const allHistoricTxs = await transactionRepo.getAll({});
      
      const statementBills: Transaction[] = [];
      const ccAccounts = loadedAccounts.filter(a => a.type === 'credit_card' && a.closingDay && a.paymentDay);
      
      const targetMonths = [
        { year: currentYear, month: currentMonth },
        { 
          year: currentMonth === 12 ? currentYear + 1 : currentYear, 
          month: currentMonth === 12 ? 1 : currentMonth + 1 
        }
      ];

      for (const target of targetMonths) {
        for (const card of ccAccounts) {
          try {
            // Encontrar todas las compras diferidas en esta tarjeta
            const activeInstallments = allHistoricTxs.filter(tx => 
              tx.accountId === card.id && 
              tx.type === 'expense' && 
              (tx.aiMetadata as any)?.installments
            );

            let totalInstallmentsSum = 0;
            const details: string[] = [];

            for (const tx of activeInstallments) {
              const inst = (tx.aiMetadata as any).installments;
              const count = inst.count;
              const monthlyAmount = inst.monthlyAmount;
              const purchaseDateStr = inst.startDate || tx.transactionDate;
              
              // Calcular FCD (Primer cierre facturado):
              // Si el día del gasto es <= closingDay de la tarjeta, cierra ese mismo mes.
              // Si es > closingDay, cierra el mes siguiente.
              const pd = parseLocalDate(purchaseDateStr);
              const pDay = pd.getDate();
              
              let fcdYear = pd.getFullYear();
              let fcdMonth = pd.getMonth(); // 0-11
              
              if (pDay > card.closingDay!) {
                fcdMonth += 1;
                if (fcdMonth > 11) {
                  fcdMonth = 0;
                  fcdYear += 1;
                }
              }
              
              const fcd = new Date(fcdYear, fcdMonth, card.closingDay!);
              
              // Calcular SD (Cierre del estado de este mes consultado):
              // El pago correspondiente al mes consultado (target.month) cierra el mes anterior (target.month - 2 en 0-indexed)
              let sdYear = target.year;
              let sdMonth = target.month - 2;
              if (sdMonth < 0) {
                sdMonth = 11;
                sdYear -= 1;
              }
              
              const sd = new Date(sdYear, sdMonth, card.closingDay!);
              
              // Calcular diferencia en meses
              const diffMonths = (sd.getFullYear() - fcd.getFullYear()) * 12 + (sd.getMonth() - fcd.getMonth());
              
              if (diffMonths >= 0 && diffMonths < count) {
                totalInstallmentsSum += monthlyAmount;
                details.push(`${tx.merchantName || tx.description || 'Compra'} (Cuota ${diffMonths + 1}/${count}: $${monthlyAmount.toLocaleString('es-CO')})`);
              }
            }

            if (totalInstallmentsSum > 0) {
              // Determinar si ya existe un abono/transferencia confirmado a esta tarjeta en este mes
              const isPaid = txs.some(tx => {
                if (tx.type !== 'transfer' || tx.transferToAccountId !== card.id || tx.status !== 'confirmed') {
                  return false;
                }
                const parts = tx.transactionDate.split('-');
                return parts.length === 3 &&
                  parseInt(parts[1], 10) === target.month &&
                  parseInt(parts[0], 10) === target.year;
              });

              // Buscar la cuenta origen por defecto (la primera cuenta de ahorros/banco)
              const defaultSource = loadedAccounts.find(a => a.type === 'bank' && a.id !== card.id) || loadedAccounts[0];

              statementBills.push({
                id: `cc-statement-${card.id}-${target.year}-${target.month}`,
                familyGroupId: card.familyGroupId,
                accountId: defaultSource.id, // Origen por defecto
                categoryId: null,
                createdByUserId: '',
                type: 'transfer',
                amount: totalInstallmentsSum,
                currency: 'COP',
                description: `Pago Tarjeta: ${card.name}`,
                merchantName: null,
                transactionDate: `${target.year}-${String(target.month).padStart(2, '0')}-${String(card.paymentDay).padStart(2, '0')}`,
                transferToAccountId: card.id,
                isRecurringInstance: false,
                recurringRuleId: null,
                status: isPaid ? 'confirmed' : 'pending',
                inputMethod: 'manual',
                aiMetadata: {
                  isCCStatement: true,
                  cardId: card.id,
                  installmentsSum: totalInstallmentsSum,
                  details: details.join(', '),
                  dueDate: `${target.year}-${String(target.month).padStart(2, '0')}-${String(card.paymentDay).padStart(2, '0')}`
                } as any,
                isPrivate: false,
                syncedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          } catch (cardErr) {
            console.error(`[Bills CC Card Error for ${card.name}]:`, cardErr);
          }
        }
      }
      
      // Filtramos las que califican como Bills (cosas POR PAGAR o ya pagadas con vencimiento):
      // 1. Transacciones que están en estado 'pending' (facturas por pagar).
      // 2. Transacciones 'confirmed' que provienen de recurrencias (facturas ya pagadas).
      // 3. Transacciones con dueDate en aiMetadata (facturas manuales ya pagadas).
      const filteredBills = txs.filter(tx =>
        tx.type !== 'income' &&
        tx.inputMethod !== 'email' &&
        (tx.status === 'pending' || tx.isRecurringInstance || !!tx.aiMetadata?.dueDate)
      );
      
      setBills([...filteredBills, ...statementBills]);

      // Por defecto, NO seleccionar ningún día para mostrar el resumen mensual agrupado
      // Mantener selectedDate vacío a menos que el usuario pulse un día específico

      // Programar o actualizar las alertas de facturas por vencer
      BillAlertService.scheduleBillAlerts().catch(() => {});

    } catch (err) {
      console.error('[Bills Load Error]:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [currentYear, currentMonth])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handlePayBill = (bill: Transaction) => {
    if ((bill.aiMetadata as any)?.isCCStatement) {
      router.push({
        pathname: '/transaction/new',
        params: {
          type: 'transfer',
          accountId: bill.accountId,
          transferToAccountId: bill.transferToAccountId || '',
          amount: String(bill.amount),
          description: bill.description
        }
      });
    } else {
      router.push({ pathname: '/transaction/new', params: { id: bill.id } });
    }
  };

  // Registrar o actualizar una factura
  const handleSaveBill = async () => {
    if (!billAmount || !billDescription.trim() || !billDate) {
      setErrorMsg('Por favor rellena los campos obligatorios.');
      return;
    }
    if (billType === 'expense' && !billCategoryId) {
      setErrorMsg('Selecciona una categoría para la factura.');
      return;
    }
    if (billType === 'transfer' && !billTransferToAccountId) {
      setErrorMsg('Selecciona la cuenta destino (tarjeta o crédito) que vas a pagar.');
      return;
    }
    setSavingBill(true);
    setErrorMsg(null);

    try {
      const amountVal = parseFloat(billAmount);
      const inputData = {
        accountId: billAccountId,
        categoryId: billType === 'expense' ? (billCategoryId || null) : null,
        type: billType,
        amount: amountVal,
        description: billDescription.trim(),
        transactionDate: billDate,
        inputMethod: 'manual',
        transferToAccountId: billType === 'transfer' ? billTransferToAccountId : null,
        status: 'pending',
        isRecurringInstance: editingBill ? editingBill.isRecurringInstance : false,
        recurringRuleId: editingBill ? editingBill.recurringRuleId : null,
        aiMetadata: {
          rawInput: '',
          parsedAmount: amountVal,
          parsedCategory: null,
          parsedAccount: null,
          parsedMerchant: null,
          confidence: 1,
          corrections: {},
          dueDate: billDate,
          // Al corregir la fecha de una cuota recurrente, esta pasa a "cubrir" la nueva
          // fecha: si se dejara la fecha original, la próxima generación automática no
          // reconocería la fecha corregida como ya cubierta y crearía una duplicada.
          occurrenceDate: editingBill ? billDate : undefined,
        }
      } as any;

      if (editingBill) {
        await transactionRepo.update(editingBill.id, inputData);
      } else {
        await transactionRepo.create(inputData);
      }

      setIsDialogVisible(false);
      setBillAmount('');
      setBillDescription('');
      setBillType('expense');
      setBillTransferToAccountId('');
      setEditingBill(null);
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la factura.');
    } finally {
      setSavingBill(false);
    }
  };

  const handleDeleteBill = async () => {
    if (!editingBill) return;

    if (editingBill.isRecurringInstance && editingBill.recurringRuleId) {
      // Cerrar el diálogo de edición ANTES de mostrar la confirmación: ambos son
      // "Portal" superpuestos y, si se dejan los dos abiertos, la confirmación queda
      // tapada detrás del diálogo de edición y sus botones no se pueden tocar.
      setIsDialogVisible(false);
      AppAlert.alert(
        'Eliminar Recurrencia',
        'Esta factura proviene de una regla recurrente. ¿Deseas cancelar la recurrencia completa (todos los meses futuros) o solo saltar el pago de este mes?',
        [
          {
            text: 'Cancelar toda la recurrencia',
            style: 'destructive',
            onPress: async () => {
              setSavingBill(true);
              try {
                await recurrenceRepo.delete(editingBill.recurringRuleId!);
                // Al cancelar la recurrencia también se borran las facturas pendientes ya
                // generadas para ella (las pagadas/confirmadas se conservan como historial).
                const pendingInstances = await transactionRepo.getAll({
                  recurringRuleId: editingBill.recurringRuleId!,
                  status: 'pending',
                });
                await Promise.all(pendingInstances.map(tx => transactionRepo.delete(tx.id)));
                setIsDialogVisible(false);
                setEditingBill(null);
                loadData(true);
              } catch (err) {
                setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar la regla recurrente.');
              } finally {
                setSavingBill(false);
              }
            }
          },
          {
            text: 'Saltar solo este mes',
            onPress: async () => {
              setSavingBill(true);
              try {
                // Modificar el registro para poner monto 0 y estado confirmado (saltado)
                await transactionRepo.update(editingBill.id, {
                  amount: 0,
                  status: 'confirmed',
                  isRecurringInstance: true,
                  recurringRuleId: editingBill.recurringRuleId,
                  aiMetadata: {
                    ...(editingBill.aiMetadata || {}),
                    isSkipped: true,
                    dueDate: editingBill.aiMetadata?.dueDate || editingBill.transactionDate,
                    occurrenceDate: (editingBill.aiMetadata as any)?.occurrenceDate || editingBill.aiMetadata?.dueDate || editingBill.transactionDate
                  }
                } as any);
                setIsDialogVisible(false);
                setEditingBill(null);
                loadData(true);
              } catch (err) {
                setErrorMsg(err instanceof Error ? err.message : 'Error al saltar la cuota.');
              } finally {
                setSavingBill(false);
              }
            }
          },
          {
            text: 'Cancelar',
            style: 'cancel'
          }
        ]
      );
    } else {
      setSavingBill(true);
      try {
        await transactionRepo.delete(editingBill.id);
        setIsDialogVisible(false);
        setEditingBill(null);
        loadData(true);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar la factura.');
      } finally {
        setSavingBill(false);
      }
    }
  };

  const openCreateDialog = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setBillDate(selectedDate || todayStr);
    setBillType('expense');
    setBillTransferToAccountId('');
    setBillDescription('');
    setBillAmount('');
    setEditingBill(null);
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  const openEditDialog = (bill: Transaction) => {
    if ((bill.aiMetadata as any)?.isCCStatement) {
      AppAlert.alert(
        'Factura Proyectada de Tarjeta',
        'Esta factura es una estimación de tus cobros a cuotas consolidados. Para modificar este valor, puedes hacer un pago parcial al liquidarla, o editar las compras diferidas originales.'
      );
      return;
    }
    setEditingBill(bill);
    setBillAmount(String(bill.amount));
    setBillDescription(bill.description || '');
    setBillAccountId(bill.accountId);
    setBillCategoryId(bill.categoryId || '');
    setBillDate(bill.transactionDate);
    setBillType(bill.type as any);
    setBillTransferToAccountId(bill.transferToAccountId || '');
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  // Etiqueta de cuenta a mostrar en cada factura: destino (tarjeta/crédito) para
  // facturas de transferencia, cuenta de pago para el resto.
  const getBillAccountLabel = (bill: Transaction) => {
    if (bill.type === 'transfer') {
      return `A pagar: ${accounts.find(a => a.id === bill.transferToAccountId)?.name || 'Cuenta'}`;
    }
    return `Pago vía: ${accounts.find(a => a.id === bill.accountId)?.name || 'Cuenta'}`;
  };

  // Nombres de los meses en español
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // ─── GENERADOR DE CALENDARIO EN PURE REACT NATIVE ──────────────────────

  const renderCalendar = () => {
    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0];

    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().split('T')[0];

    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // Día de la semana en que inicia
    const totalDays = new Date(currentYear, currentMonth, 0).getDate(); // Total de días de este mes
    
    const daysArray = [];

    // Rellenar días vacíos antes del inicio de mes
    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push({ day: null, dateStr: '' });
    }

    // Rellenar días del mes
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysArray.push({ day: d, dateStr });
    }

    // Dividir en filas de 7 días (semana)
    const rows = [];
    let cells = [];

    for (let i = 0; i < daysArray.length; i++) {
      cells.push(daysArray[i]);
      if (cells.length === 7 || i === daysArray.length - 1) {
        rows.push(cells);
        cells = [];
      }
    }

    return (
      <View style={styles.calendarGrid}>
        {/* Leyenda Cromática de 4 Estados */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.outline + '20' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' }} />
            <Text style={[theme.typography.caption, { fontSize: 10, color: theme.customColors.textSecondary }]}>Pagada</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706' }} />
            <Text style={[theme.typography.caption, { fontSize: 10, color: theme.customColors.textSecondary }]}>Próxima</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' }} />
            <Text style={[theme.typography.caption, { fontSize: 10, color: theme.customColors.textSecondary }]}>Vencida</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' }} />
            <Text style={[theme.typography.caption, { fontSize: 10, color: theme.customColors.textSecondary }]}>Hoy</Text>
          </View>
        </View>

        {/* Cabecera días semana */}
        <View style={styles.weekDaysRow}>
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <Text key={d} style={[styles.weekDayText, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* Filas de días */}
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.calendarRow}>
            {row.map((cell, cellIndex) => {
              if (cell.day === null) {
                return <View key={cellIndex} style={styles.dayCellEmpty} />;
              }

              const isToday = cell.dateStr === todayStr;
              const isSelected = selectedDate === cell.dateStr;

              // Evaluar facturas de este día específico
              const dayBills = bills.filter(b => (b.aiMetadata?.dueDate || b.transactionDate) === cell.dateStr);
              const hasOverdue = dayBills.some(b => b.status === 'pending' && cell.dateStr < todayStr);
              const hasUpcoming = dayBills.some(b => b.status === 'pending' && cell.dateStr >= todayStr);
              const hasPaid = dayBills.some(b => b.status === 'confirmed');

              let circleStyle: any = {};
              let textColor = theme.colors.onSurface;

              if (dayBills.length > 0) {
                if (hasOverdue) {
                  circleStyle = { borderWidth: 2, borderColor: '#DC2626' };
                } else if (hasUpcoming) {
                  circleStyle = { borderWidth: 2, borderColor: '#D97706' };
                } else if (hasPaid) {
                  circleStyle = { borderWidth: 2, borderColor: '#059669' };
                }
              }

              if (isToday) {
                circleStyle = {
                  ...circleStyle,
                  borderColor: '#2563EB',
                  borderWidth: 2,
                };
              }

              if (isSelected) {
                circleStyle = {
                  ...circleStyle,
                  backgroundColor: theme.colors.primary,
                };
                textColor = '#FFFFFF';
              }

              return (
                <Pressable
                  key={cellIndex}
                  style={styles.dayCell}
                  onPress={() => setSelectedDate(cell.dateStr)}
                >
                  <View style={[styles.dayCircle, circleStyle]}>
                    <Text style={[styles.dayText, { color: textColor, fontWeight: isToday || isSelected ? '700' : '400' }]}>
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // Filtrado de Facturas
  const selectedDayBills = bills.filter(b => b.amount > 0 && (b.aiMetadata?.dueDate || b.transactionDate) === selectedDate);
  const totalBillsAmountInMonth = bills.reduce((sum, b) => sum + b.amount, 0);

  // Helper para ordenar por fecha de vencimiento (más antigua/próxima primero)
  const sortByDateAsc = (a: Transaction, b: Transaction) => {
    const dateA = a.aiMetadata?.dueDate || a.transactionDate;
    const dateB = b.aiMetadata?.dueDate || b.transactionDate;
    return dateA.localeCompare(dateB);
  };

  // Agrupamiento mensual por defecto (solo del mes seleccionado)
  const unpaidBills = bills.filter(b => {
    if (b.status !== 'pending' || b.amount === 0) return false;
    const d = b.aiMetadata?.dueDate || b.transactionDate;
    const parts = d.split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[1], 10) === currentMonth && parseInt(parts[0], 10) === currentYear;
  }).sort(sortByDateAsc);
  
  const paidBills = bills.filter(b => {
    if (b.status !== 'confirmed' || b.amount === 0) return false;
    const d = b.aiMetadata?.dueDate || b.transactionDate;
    const parts = d.split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[1], 10) === currentMonth && parseInt(parts[0], 10) === currentYear;
  }).sort(sortByDateAsc);

  // Facturas futuras sin pagar (de meses posteriores al seleccionado)
  const futureUnpaid = bills.filter(b => {
    if (b.status !== 'pending' || b.amount === 0) return false;
    const d = b.aiMetadata?.dueDate || b.transactionDate;
    const parts = d.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return y > currentYear || (y === currentYear && m > currentMonth);
  }).sort(sortByDateAsc);

  const totalUnpaid = unpaidBills.reduce((s, b) => s + b.amount, 0);
  const totalPaid = paidBills.reduce((s, b) => s + b.amount, 0);

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Cálculo de progreso mensual para la tarjeta inteligente
  const totalMonthBillsCount = paidBills.length + unpaidBills.length;
  const monthProgress = totalMonthBillsCount > 0 ? (paidBills.length / totalMonthBillsCount) * 100 : 0;
  const todayDateStr = new Date().toISOString().split('T')[0];
  const nextImminentBill = unpaidBills.find(b => {
    const d = b.aiMetadata?.dueDate || b.transactionDate;
    return d >= todayDateStr;
  }) || unpaidBills[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NetworkStatusBar />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        {/* ─── TARJETA INTELIGENTE DE RESUMEN DEL MES ──────────────────────── */}
        {selectedDate === '' && (
          <Surface style={[theme.shadows.sm, { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.outline + '30' }]}>
            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontWeight: '600', marginBottom: 4 }]}>
              Facturas pendientes este mes
            </Text>
            
            <Text style={[theme.typography.amountLarge, { color: totalUnpaid > 0 ? '#DC2626' : '#059669', fontSize: 30, fontWeight: '800', marginBottom: 12 }]}>
              $ {Math.round(totalUnpaid).toLocaleString('es-CO')}
            </Text>

            {/* Barra de progreso de facturas pagadas vs total */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontWeight: '600' }]}>
                  Progreso del mes
                </Text>
                <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
                  {paidBills.length} de {totalMonthBillsCount} pagadas ({Math.round(monthProgress)}%)
                </Text>
              </View>
              <View style={{ height: 8, width: '100%', backgroundColor: theme.colors.outline + '20', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.min(Math.max(monthProgress, 0), 100)}%`, backgroundColor: '#059669', borderRadius: 4 }} />
              </View>
            </View>

            {/* Badges de estado rápido */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#05966915', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <MaterialCommunityIcons name="check-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                <Text style={[theme.typography.caption, { color: '#059669', fontWeight: '700' }]}>
                  {paidBills.length} pagadas
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: totalUnpaid > 0 ? '#DC262615' : '#05966915', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <MaterialCommunityIcons name="clock-alert-outline" size={14} color={totalUnpaid > 0 ? '#DC2626' : '#059669'} style={{ marginRight: 4 }} />
                <Text style={[theme.typography.caption, { color: totalUnpaid > 0 ? '#DC2626' : '#059669', fontWeight: '700' }]}>
                  {unpaidBills.length} pendientes
                </Text>
              </View>
            </View>

            {/* Ficha Próximo Vencimiento */}
            {nextImminentBill && (
              <View style={{ backgroundColor: theme.colors.background, borderRadius: 14, padding: 12, borderLeftWidth: 4, borderLeftColor: '#D97706' }}>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }]}>
                  Próximo vencimiento
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]} numberOfLines={1}>
                      {parseLocalDate(nextImminentBill.aiMetadata?.dueDate || nextImminentBill.transactionDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} • {nextImminentBill.description}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      $ {Math.round(nextImminentBill.amount).toLocaleString('es-CO')} COP
                    </Text>
                  </View>
                  <Button
                    mode="contained"
                    compact
                    onPress={() => handlePayBill(nextImminentBill)}
                    style={{ backgroundColor: '#059669', borderRadius: 10 }}
                    labelStyle={{ fontSize: 11, fontWeight: '700' }}
                  >
                    Pagar ahora
                  </Button>
                </View>
              </View>
            )}
          </Surface>
        )}

        {/* ─── ENLACE CALENDARIO COLAPSABLE ─────────────────────────────────── */}
        <Pressable
          onPress={() => setIsCalendarVisible(!isCalendarVisible)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, marginBottom: 12 }}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700', marginRight: 4 }]}>
            {isCalendarVisible ? '▴ Ocultar calendario' : '▾ Ver calendario'}
          </Text>
        </Pressable>

        {/* ─── CARD CALENDARIO (COLAPSABLE POR DEFECTO) ──────────────────────── */}
        {isCalendarVisible && (
          <Card style={[styles.calendarCard, { marginBottom: 16 }]}>
            <Card.Content>
              {renderCalendar()}
            </Card.Content>
          </Card>
        )}

        {/* ─── VISTA FILTRADA POR DÍA SELECCIONADO ─────────────────────────── */}
        {selectedDate !== '' ? (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface, flex: 1 }]}>
                Facturas para el {parseLocalDate(selectedDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
              </Text>
              <Button compact mode="text" onPress={() => setSelectedDate('')} style={styles.clearFilterBtn}>
                Ver todo el mes
              </Button>
            </View>

            {selectedDayBills.length === 0 ? (
              <EmptyState
                icon="calendar-check"
                title="Sin facturas agendadas"
                description="No tienes pagos agendados para este día."
              />
            ) : (
              <View style={styles.billsList}>
                {selectedDayBills.map(bill => {
                  const isPaid = bill.status === 'confirmed';
                  return (
                    <Card key={bill.id} style={styles.billCard}>
                      <Card.Content style={styles.billCardContent}>
                        <Pressable style={[styles.billInfo, { flex: 1 }]} onPress={() => openEditDialog(bill)}>
                          <Text style={[theme.typography.h4, { fontWeight: '600', color: theme.colors.primary }]}>
                            {bill.description}
                          </Text>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginTop: 4 }]}>
                            {getBillAccountLabel(bill)}
                            {isPaid && bill.transactionDate !== (bill.aiMetadata?.dueDate || bill.transactionDate) ? (
                              ` • Pagada el: ${new Date(bill.transactionDate + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
                            ) : ''}
                          </Text>
                        </Pressable>

                        <View style={styles.billActionRow}>
                          <View style={styles.amountCol}>
                            <AmountDisplay amount={bill.amount} size="sm" type="expense" />
                            <Text style={[
                              styles.statusText,
                              theme.typography.caption,
                              { color: isPaid ? theme.customColors.success : theme.customColors.textSecondary }
                            ]}>
                              {isPaid ? 'Pagado' : 'Pendiente'}
                            </Text>
                          </View>

                          {!isPaid && (
                            <Button
                              mode="contained"
                              compact
                              onPress={() => handlePayBill(bill)}
                              style={[styles.payBtn, { backgroundColor: '#059669' }]}
                              labelStyle={{ fontSize: 11, paddingHorizontal: 4 }}
                            >
                              Pagar
                            </Button>
                          )}
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          /* ─── VISTA DE RESUMEN MENSUAL GRUPAL (ACORDEONES) ───────────────── */
          <View>
            {/* Grupo 1: SIN PAGAR ESTE MES (Colapsable, abierto por defecto) */}
            <Surface style={[theme.shadows.sm, { backgroundColor: theme.colors.surface, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.outline + '20' }]}>
              <Pressable
                onPress={() => setIsUnpaidExpanded(!isUnpaidExpanded)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: theme.customColors.dangerLight }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[theme.typography.h4, { color: theme.colors.error, fontWeight: '800' }]}>
                    SIN PAGAR ({unpaidBills.length})
                  </Text>
                  <MaterialCommunityIcons name={isUnpaidExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.error} />
                </View>
                <AmountDisplay amount={totalUnpaid} size="sm" type="expense" />
              </Pressable>

              {isUnpaidExpanded && (
                <View style={{ paddingVertical: 4 }}>
                  {unpaidBills.length === 0 ? (
                    <Text style={[theme.typography.bodySmall, { padding: 16, opacity: 0.6, textAlign: 'center' }]}>
                      ¡Al día! No tienes facturas pendientes este mes.
                    </Text>
                  ) : (
                    unpaidBills.map(bill => (
                      <List.Item
                        key={bill.id}
                        title={bill.description}
                        titleStyle={{ color: theme.colors.primary, fontWeight: '600' }}
                        onPress={() => openEditDialog(bill)}
                        description={`Vence: ${parseLocalDate(bill.aiMetadata?.dueDate || bill.transactionDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} • ${getBillAccountLabel(bill)}`}
                        left={props => <List.Icon {...props} icon="clock-alert-outline" color={theme.customColors.accent} />}
                        right={() => (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AmountDisplay amount={bill.amount} size="sm" type="neutral" style={{ marginRight: 10 }} />
                            <Button
                              mode="contained"
                              compact
                              onPress={() => handlePayBill(bill)}
                              style={{ backgroundColor: '#059669', borderRadius: 8 }}
                              labelStyle={{ fontSize: 10, paddingHorizontal: 4 }}
                            >
                              Pagar
                            </Button>
                          </View>
                        )}
                        style={styles.listItemBottomBorder}
                      />
                    ))
                  )}
                </View>
              )}
            </Surface>

            {/* Grupo 2: PAGADAS (Colapsable, contraído por defecto) */}
            <Surface style={[theme.shadows.sm, { backgroundColor: theme.colors.surface, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.outline + '20' }]}>
              <Pressable
                onPress={() => setIsPaidExpanded(!isPaidExpanded)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: theme.customColors.successLight }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[theme.typography.h4, { color: theme.customColors.success, fontWeight: '800' }]}>
                    PAGADAS ({paidBills.length})
                  </Text>
                  <MaterialCommunityIcons name={isPaidExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.customColors.success} />
                </View>
                <AmountDisplay amount={totalPaid} size="sm" type="expense" />
              </Pressable>

              {isPaidExpanded && (
                <View style={{ paddingVertical: 4 }}>
                  {paidBills.length === 0 ? (
                    <Text style={[theme.typography.bodySmall, { padding: 16, opacity: 0.6, textAlign: 'center' }]}>
                      No has pagado facturas todavía este mes.
                    </Text>
                  ) : (
                    paidBills.map(bill => (
                      <List.Item
                        key={bill.id}
                        title={bill.description}
                        titleStyle={{ color: theme.colors.primary, fontWeight: '600' }}
                        onPress={() => {
                          // Al dar clic en una factura pagada, abre el detalle de la transacción correspondiente
                          router.push({ pathname: '/transaction/new', params: { id: bill.id } });
                        }}
                        description={`Vence: ${parseLocalDate(bill.aiMetadata?.dueDate || bill.transactionDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}${bill.transactionDate !== (bill.aiMetadata?.dueDate || bill.transactionDate) ? ` • Pagada el: ${parseLocalDate(bill.transactionDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : ''} • ${getBillAccountLabel(bill)}`}
                        left={props => <List.Icon {...props} icon="check-circle-outline" color="#059669" />}
                        right={() => (
                          <View style={{ justifyContent: 'center' }}>
                            <AmountDisplay amount={bill.amount} size="sm" type="neutral" />
                          </View>
                        )}
                        style={styles.listItemBottomBorder}
                      />
                    ))
                  )}
                </View>
              )}
            </Surface>

            {/* Grupo 3: FUTURAS PENDIENTES */}
            {futureUnpaid.length > 0 && (
              <Card style={styles.summaryGroupCard}>
                <View style={[styles.summaryGroupHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[theme.typography.h4, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                    PROYECTADAS / FUTURAS PENDIENTES
                  </Text>
                  <AmountDisplay amount={futureUnpaid.reduce((s, b) => s + b.amount, 0)} size="sm" type="neutral" />
                </View>
                <Card.Content style={{ paddingVertical: 8 }}>
                  {futureUnpaid.map(bill => (
                    <List.Item
                      key={bill.id}
                      title={bill.description}
                      titleStyle={{ color: theme.colors.primary, fontWeight: '500' }}
                      onPress={() => openEditDialog(bill)}
                      description={`Vence: ${parseLocalDate(bill.aiMetadata?.dueDate || bill.transactionDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} • ${getBillAccountLabel(bill)}`}
                      left={props => <List.Icon {...props} icon="calendar-clock" color={theme.colors.primary} />}
                      right={() => (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <AmountDisplay amount={bill.amount} size="sm" type="neutral" style={{ marginRight: 10 }} />
                          <Button
                            mode="contained"
                            compact
                            onPress={() => handlePayBill(bill)}
                            style={{ backgroundColor: '#059669', borderRadius: 8 }}
                            labelStyle={{ fontSize: 10, paddingHorizontal: 4 }}
                          >
                            Pagar
                          </Button>
                        </View>
                      )}
                      style={styles.listItemBottomBorder}
                    />
                  ))}
                </Card.Content>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── PORTAL DIÁLOGO: AGREGAR FACTURA / BILL AL VUELO ──────────────── */}
      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)}>
          <Dialog.Title>{editingBill ? 'Editar Factura' : 'Registrar Factura'}</Dialog.Title>
          <Dialog.Content>
            <ScrollView
              style={{ maxHeight: Dimensions.get('window').height * 0.45 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
            {errorMsg && <HelperText type="error" visible={!!errorMsg}>{errorMsg}</HelperText>}
            
            <TextInput
              label="Descripción de la factura (ej: Recibo de la Luz)"
              value={billDescription}
              onChangeText={(txt) => { setBillDescription(txt); setErrorMsg(null); }}
              mode="outlined"
              style={styles.dialogInput}
              disabled={savingBill}
            />

            <TextInput
              label="Monto de la Factura ($)"
              value={billAmount}
              onChangeText={(txt) => { setBillAmount(txt.replace(/[^0-9.]/g, '')); setErrorMsg(null); }}
              mode="outlined"
              keyboardType="numeric"
              style={styles.dialogInput}
              disabled={savingBill}
            />

            {/* Calendario Nativo Web o Campo Móvil */}
            {Platform.OS === 'web' ? (
              <View style={styles.webDateContainer}>
                <Text style={[styles.dialogSelectLabel, theme.typography.caption]}>Fecha de Vencimiento</Text>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => { setBillDate(e.target.value); setErrorMsg(null); }}
                  style={webStyles.dateInput}
                  disabled={savingBill}
                />
              </View>
            ) : (
              <View>
                <Pressable onPress={() => setShowDatePicker(true)}>
                  <View pointerEvents="none">
                    <TextInput
                      label="Fecha de Vencimiento"
                      value={billDate}
                      mode="outlined"
                      style={styles.dialogInput}
                      disabled={savingBill}
                      right={<TextInput.Icon icon="calendar" />}
                    />
                  </View>
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={(() => {
                      const parts = billDate.split('-');
                      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    })()}
                    mode="date"
                    display="default"
                    onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                      setShowDatePicker(false);
                      if (selectedDate && event.type === 'set') {
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        setBillDate(`${year}-${month}-${day}`);
                        setErrorMsg(null);
                      }
                    }}
                  />
                )}
              </View>
            )}

            <Text style={[styles.dialogSelectLabel, theme.typography.caption, { marginTop: 12 }]}>Tipo de Factura</Text>
            <SegmentedButtons
              value={billType}
              onValueChange={(val) => {
                setBillType(val as 'expense' | 'transfer');
                setBillCategoryId('');
                setBillTransferToAccountId('');
              }}
              buttons={[
                { value: 'expense', label: 'Gasto / Servicio', icon: 'receipt-text-outline', disabled: savingBill },
                { value: 'transfer', label: 'Pago Tarjeta / Crédito', icon: 'credit-card-outline', disabled: savingBill },
              ]}
              style={styles.dialogInput}
            />

            {billType === 'expense' ? (
              <>
                <Text style={[styles.dialogSelectLabel, theme.typography.caption, { marginTop: 12 }]}>Categoría</Text>
                <CategoryPickerMenu
                  categories={categories}
                  selectedCategoryId={billCategoryId}
                  onSelect={setBillCategoryId}
                  excludeNamesContaining="ingreso"
                  disabled={savingBill}
                  style={styles.categorySelectBtn}
                />
              </>
            ) : (
              <>
                <Text style={[styles.dialogSelectLabel, theme.typography.caption, { marginTop: 12 }]}>Cuenta Destino (tarjeta o crédito a pagar)</Text>
                <View style={{ flexDirection: 'row' }}>
                  <Menu
                    visible={showAccountMenu}
                    onDismiss={() => setShowAccountMenu(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setShowAccountMenu(true)}
                        style={styles.categorySelectBtn}
                        icon="credit-card-outline"
                        disabled={savingBill}
                      >
                        {accounts.find(a => a.id === billTransferToAccountId)?.name || 'Seleccionar Cuenta'}
                      </Button>
                    }
                  >
                    <ScrollView style={{ maxHeight: 200 }}>
                      {accounts.filter(a => ['credit_card', 'loan', 'mortgage'].includes(a.type)).map(acc => (
                        <Menu.Item
                          key={acc.id}
                          onPress={() => {
                            setBillTransferToAccountId(acc.id);
                            setShowAccountMenu(false);
                          }}
                          title={acc.name}
                          leadingIcon="credit-card-outline"
                        />
                      ))}
                    </ScrollView>
                  </Menu>
                </View>
                {accounts.filter(a => ['credit_card', 'loan', 'mortgage'].includes(a.type)).length === 0 && (
                  <HelperText type="info" visible={true}>
                    No tienes tarjetas ni créditos registrados. Créalos primero en Cuentas y Deudas.
                  </HelperText>
                )}
              </>
            )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            {editingBill && (
              <Button
                onPress={handleDeleteBill}
                textColor={theme.colors.error}
                style={{ marginRight: 'auto' }}
                disabled={savingBill}
              >
                Eliminar
              </Button>
            )}
            <Button onPress={() => setIsDialogVisible(false)} textColor={theme.customColors.textSecondary} disabled={savingBill}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveBill}
              loading={savingBill}
              disabled={
                savingBill ||
                !billAmount ||
                !billDescription.trim() ||
                (billType === 'expense' ? !billCategoryId : !billTransferToAccountId)
              }
              style={{ marginLeft: 8 }}
            >
              {editingBill ? 'Guardar' : 'Registrar'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitleContainer: {
    marginLeft: 8,
    flex: 1,
  },
  headerAddBtn: {
    margin: 0,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  calendarCard: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  calendarGrid: {
    width: '100%',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    paddingBottom: 8,
  },
  weekDayText: {
    fontWeight: 'bold',
    width: '14.28%',
    textAlign: 'center',
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginVertical: 12,
  },
  clearFilterBtn: {
    alignSelf: 'center',
  },
  billsList: {
    marginBottom: 16,
  },
  billCard: {
    marginBottom: 10,
    borderRadius: 12,
  },
  billCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billInfo: {
    flex: 1,
  },
  billActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountCol: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  statusText: {
    marginTop: 2,
    fontWeight: 'bold',
  },
  payBtn: {
    borderRadius: 8,
  },
  dialogInput: {
    marginBottom: 12,
  },
  dialogSelectLabel: {
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 8,
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  typeBtn: {
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 8,
  },
  summaryGroupCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  listItemBottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.02)',
  },
  webDateContainer: {
    marginBottom: 12,
  },
  categorySelectBtn: {
    borderRadius: 8,
    marginTop: 4,
    flex: 1,
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
