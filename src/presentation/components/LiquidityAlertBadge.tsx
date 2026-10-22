/**
 * ZenMoney — LiquidityAlertBadge
 *
 * Badge y tarjeta de alerta preventiva de liquidez y días de anticipación de quiebre.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';

export interface LiquidityAlertBadgeProps {
  isAtRisk: boolean;
  daysToDeficit?: number | null;
  deficitDate?: string | null;
  minimumBalance: number;
  minimumBalanceDate?: string;
  horizonDays: number;
}

export const LiquidityAlertBadge: React.FC<LiquidityAlertBadgeProps> = ({
  isAtRisk,
  daysToDeficit,
  deficitDate,
  minimumBalance,
  minimumBalanceDate,
  horizonDays,
}) => {
  const theme = useAppTheme();

  if (isAtRisk) {
    const isImminent = (daysToDeficit ?? 999) <= 15;
    const accentColor = isImminent ? '#DC2626' : '#EA580C';
    const bgColor = isImminent ? '#FEF2F2' : '#FFF7ED';

    return (
      <Surface
        style={[
          styles.container,
          {
            backgroundColor: bgColor,
            borderColor: accentColor + '40',
          },
        ]}
        elevation={0}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: accentColor + '20' },
            ]}
          >
            <MaterialCommunityIcons
              name="alert-rhombus-outline"
              size={22}
              color={accentColor}
            />
          </View>
          <View style={styles.textContainer}>
            <Text
              style={[
                theme.typography.caption,
                { color: accentColor, fontWeight: '700', fontSize: 13 },
              ]}
            >
              {daysToDeficit !== null && daysToDeficit !== undefined
                ? `Alerta de Liquidez: Déficit en ${daysToDeficit} días`
                : 'Alerta de Liquidez: Déficit Proyectado'}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.onSurfaceVariant, fontSize: 11, marginTop: 2 },
              ]}
            >
              {deficitDate
                ? `El saldo proyectado entrará en números rojos el ${deficitDate}. Saldo mínimo previsto: -$${Math.abs(minimumBalance).toLocaleString('es-CO')}.`
                : `Se prevé un saldo negativo de -$${Math.abs(minimumBalance).toLocaleString('es-CO')} dentro del horizonte de ${horizonDays} días.`}
            </Text>
          </View>
        </View>
      </Surface>
    );
  }

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: '#ECFDF5',
          borderColor: '#10B98140',
        },
      ]}
      elevation={0}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: '#10B98120' },
          ]}
        >
          <MaterialCommunityIcons
            name="check-decagram-outline"
            size={22}
            color="#059669"
          />
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[
              theme.typography.caption,
              { color: '#059669', fontWeight: '700', fontSize: 13 },
            ]}
          >
            Flujo de Caja Saludable ({horizonDays} días)
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.onSurfaceVariant, fontSize: 11, marginTop: 2 },
            ]}
          >
            No se proyectan déficits. El punto más bajo de caja será de $
            {minimumBalance.toLocaleString('es-CO')}
            {minimumBalanceDate ? ` el ${minimumBalanceDate}` : ''}.
          </Text>
        </View>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
});
