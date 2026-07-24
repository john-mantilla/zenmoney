/**
 * ZenMoney — Componente BalanceCard (Efecto Midnight Gradient & Glassmorphism)
 *
 * Muestra el disponible líquido y resumen de ingresos/gastos con un gradiente
 * profundo azul noche, bordes con biselado de cristal (glassmorphism) y sombras multicapa.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';
import { AmountDisplay } from './AmountDisplay';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface BalanceCardProps {
  balance: number;
  income: number;
  expenses: number;
  currency?: string;
  label?: string;
  onPressAnalysis?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  income,
  expenses,
  currency = 'COP',
  label = 'DISPONIBLE LÍQUIDO',
  onPressAnalysis,
}) => {
  const theme = useAppTheme();
  const [isHidden, setIsHidden] = useState(false);

  return (
    <View style={styles.shadowWrapper}>
      <LinearGradient
        colors={['#1E293B', '#0F172A', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Resplandor Glassmorphism sutil en el borde superior */}
        <View style={styles.glassHighlight} />

        <View style={styles.content}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.label, theme.typography.label, { color: '#94A3B8', marginBottom: 0 }]}>
                {label}
              </Text>
              <Pressable onPress={() => setIsHidden(!isHidden)} hitSlop={8}>
                <MaterialCommunityIcons
                  name={isHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>
            </View>

            {onPressAnalysis && (
              <Pressable
                onPress={onPressAnalysis}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  gap: 4,
                }}
              >
                <MaterialCommunityIcons name="chart-bar" size={14} color="#38BDF8" />
                <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700' }}>Ver análisis</Text>
              </Pressable>
            )}
          </View>
          
          {isHidden ? (
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginVertical: 4 }}>
              $ ••••••••
            </Text>
          ) : (
            <AmountDisplay
              amount={balance}
              currency={currency}
              size="lg"
              style={styles.balanceText}
            />
          )}

          {/* Separador translúcido */}
          <View style={styles.divider} />

          {/* Desglose rápido de ingresos y gastos */}
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <MaterialCommunityIcons name="arrow-down-bold" size={16} color="#10B981" />
              </View>
              <View style={styles.breakdownText}>
                <Text style={[styles.breakdownLabel, theme.typography.caption, { color: '#94A3B8' }]}>
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
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <MaterialCommunityIcons name="arrow-up-bold" size={16} color="#EF4444" />
              </View>
              <View style={styles.breakdownText}>
                <Text style={[styles.breakdownLabel, theme.typography.caption, { color: '#94A3B8' }]}>
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
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  shadowWrapper: {
    marginVertical: 12,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  container: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  content: {
    padding: 24,
    zIndex: 1,
  },
  label: {
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  balanceText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 18,
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
