/**
 * ZenMoney — Componente BalanceCard
 *
 * Muestra el saldo total y un mini-desglose rápido de ingresos y gastos.
 * Utiliza un degradado visual sutil sobre los colores primarios.
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../theme';
import { AmountDisplay } from './AmountDisplay';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface BalanceCardProps {
  balance: number;
  income: number;
  expenses: number;
  currency?: string;
  label?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  income,
  expenses,
  currency = 'COP',
  label = 'Saldo Total',
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        theme.shadows.md,
        {
          backgroundColor: theme.customColors.secondary,
        },
      ]}
    >
      {/* Sutil superposición de color para crear efecto de profundidad */}
      <View style={[styles.gradientOverlay, { backgroundColor: theme.colors.primary + '15' }]} />

      <View style={styles.content}>
        <Text style={[styles.label, theme.typography.label, { color: theme.customColors.textSecondary }]}>
          {label}
        </Text>
        
        <AmountDisplay
          amount={balance}
          currency={currency}
          size="lg"
          style={styles.balanceText}
        />

        {/* Separador */}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline + '20' }]} />

        {/* Desglose rápido de ingresos y gastos */}
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <View style={[styles.iconCircle, { backgroundColor: theme.customColors.income + '20' }]}>
              <MaterialCommunityIcons name="arrow-down-bold" size={16} color={theme.customColors.income} />
            </View>
            <View style={styles.breakdownText}>
              <Text style={[styles.breakdownLabel, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                Ingresos
              </Text>
              <AmountDisplay
                amount={income}
                currency={currency}
                size="sm"
                type="neutral"
                style={{ color: '#FFFFFF' }}
              />
            </View>
          </View>

          <View style={styles.breakdownItem}>
            <View style={[styles.iconCircle, { backgroundColor: theme.customColors.expense + '20' }]}>
              <MaterialCommunityIcons name="arrow-up-bold" size={16} color={theme.customColors.expense} />
            </View>
            <View style={styles.breakdownText}>
              <Text style={[styles.breakdownLabel, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                Gastos
              </Text>
              <AmountDisplay
                amount={expenses}
                currency={currency}
                size="sm"
                type="neutral"
                style={{ color: '#FFFFFF' }}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 8,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    padding: 24,
    zIndex: 1,
  },
  label: {
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  balanceText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  breakdownText: {
    flex: 1,
  },
  breakdownLabel: {
    marginBottom: 2,
  },
});
