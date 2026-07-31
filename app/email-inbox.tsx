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
import { SupabaseTransactionRepository } from '@/src/data/repositories/SupabaseTransactionRepository';
import { SupabaseCategoryRepository } from '@/src/data/repositories/SupabaseCategoryRepository';
import { Transaction } from '@/src/domain/entities/Transaction';
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

  const transactionRepo = new SupabaseTransactionRepository();
  const categoryRepo = new SupabaseCategoryRepository();

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingEmailTx, loadedCategories] = await Promise.all([
        transactionRepo.getAll({ status: 'pending', inputMethod: 'email' }),
        categoryRepo.getAll(true),
      ]);
      setInvoices(pendingEmailTx);
      setCategories(loadedCategories);
    } catch (err) {
      console.error('[Email Inbox Load Error]:', err);
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
      'Descartar factura',
      `¿Descartar la factura de ${tx.merchantName || 'este comercio'} por $${tx.amount.toLocaleString('es-CO')}? No se registrará ningún gasto.`,
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
              console.error('Error al descartar factura:', err);
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
        <Appbar.Content title="Movimientos por Confirmar" subtitle="Notificaciones bancarias y facturas por correo" />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
          {invoices.length === 0 ? (
            <EmptyState
              icon="email-check-outline"
              title="Sin movimientos pendientes"
              description="Cuando recibas un correo bancario o factura electrónica reenviada, aparecerá aquí para que la confirmes con 1-tap."
            />
          ) : (
            invoices.map(tx => {
              const isIncome = tx.type === 'income';
              const isBankNotif = tx.aiMetadata?.is_bank_notification;

              return (
                <Card key={tx.id} style={styles.card}>
                  <Card.Content>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={[theme.typography.h4, { fontWeight: '600' }]} numberOfLines={1}>
                          {tx.merchantName || tx.description || 'Comercio desconocido'}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginTop: 4 }]}>
                          {formatDate(tx.transactionDate)} • {getCategoryName(tx.categoryId)} • {isBankNotif ? `🏦 ${tx.aiMetadata?.bank_name || 'Banco'}` : '📄 Factura DIAN'}
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
                        Revisar y Confirmar
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
