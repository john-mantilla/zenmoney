/**
 * ZenMoney — Gastos por Confirmar (Bandeja de Facturas por Correo)
 *
 * Las facturas electrónicas que llegan por correo representan compras que el
 * usuario YA PAGÓ — no son una obligación futura como las Facturas/Bills.
 * Por eso viven en un espacio propio: se ingieren como 'pending' y solo pasan
 * a ser un gasto real cuando el usuario las revisa y confirma aquí.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { AppAlert } from '@/src/presentation/services/AppAlert';
import { Text, Card, Button, ActivityIndicator, Appbar, IconButton } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import { AmountDisplay, EmptyState } from '@/src/presentation/components';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { Transaction, isPendingConfirmationTransaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EmailInboxScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [invoices, setInvoices] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const transactionRepo = new HybridTransactionRepository();
  const categoryRepo = new HybridCategoryRepository();

  const loadData = async () => {
    setLoading(true);
    try {
      const [allPendingTx, loadedCategories] = await Promise.all([
        transactionRepo.getAll({ status: 'pending' }),
        categoryRepo.getAll(true),
      ]);
      // Excluir Facturas y Cuentas por Pagar (éstas pertenecen al calendario de Facturas/Bills)
      const unconfirmedPending = allPendingTx.filter(isPendingConfirmationTransaction);
      setInvoices(unconfirmedPending);
      setCategories(loadedCategories);
    } catch (err) {
      console.error('[Pending Inbox Load Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Sin clasificar';
    return categories.find(c => c.id === categoryId)?.name || 'Sin clasificar';
  };

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return dateObj.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleConfirm = (tx: Transaction) => {
    router.push({ pathname: '/transaction/new', params: { id: tx.id } });
  };

  const handleDiscard = (tx: Transaction) => {
    AppAlert.alert(
      'Descartar movimiento',
      `¿Descartar ${tx.merchantName || tx.description || 'este movimiento'} por $${tx.amount.toLocaleString('es-CO')}? No se registrará ningún gasto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            setDiscardingId(tx.id);
            try {
              await transactionRepo.delete(tx.id);
              loadData();
            } catch (err) {
              console.error('Error al descartar movimiento:', err);
            } finally {
              setDiscardingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }} statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Movimientos por Confirmar" subtitle="Notas de voz del reloj, notificaciones y facturas" />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
          {invoices.length === 0 ? (
            <EmptyState
              icon="check-all"
              title="Sin movimientos pendientes"
              description="Cuando recibas un correo bancario, factura electrónica o grabes una nota de voz sin monto, aparecerá aquí para que la confirmes fácilmente."
            />
          ) : (
            invoices.map(tx => {
              const isIncome = tx.type === 'income';
              const isBankNotif = tx.aiMetadata?.is_bank_notification;
              const isVoice = tx.inputMethod === 'voice' || (tx.description && tx.description.startsWith('🎙️'));
              const isEmail = tx.inputMethod === 'email';

              let sourceBadge = '⏳ Movimiento por confirmar';
              if (isVoice) {
                sourceBadge = '🎙️ Nota de voz del reloj';
              } else if (isBankNotif) {
                sourceBadge = `🏦 ${tx.aiMetadata?.bank_name || 'Banco'}`;
              } else if (isEmail) {
                sourceBadge = '📄 Factura DIAN';
              }

              return (
                <Card key={tx.id} style={styles.card}>
                  <Card.Content>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[theme.typography.h4, { fontWeight: '600' }]} numberOfLines={2}>
                          {tx.merchantName || tx.description || 'Movimiento sin descripción'}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginTop: 4 }]}>
                          {formatDate(tx.transactionDate)} • {getCategoryName(tx.categoryId)} • {sourceBadge}
                        </Text>
                      </View>
                      <AmountDisplay amount={tx.amount} type={isIncome ? 'income' : 'expense'} size="md" />
                    </View>

                    <View style={styles.actionsRow}>
                      <Button
                        onPress={() => handleDiscard(tx)}
                        textColor={theme.colors.error}
                        disabled={discardingId === tx.id}
                      >
                        Descartar
                      </Button>
                      <Button
                        mode="contained"
                        onPress={() => handleConfirm(tx)}
                        disabled={discardingId === tx.id}
                        style={{ marginLeft: 8 }}
                      >
                        {isVoice && tx.amount === 0 ? 'Completar Monto' : 'Revisar y Confirmar'}
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 780 : '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 12,
    elevation: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
});
