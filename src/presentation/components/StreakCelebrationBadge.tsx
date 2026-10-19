/**
 * ZenMoney — StreakCelebrationBadge
 *
 * Distintivo visual y dinámico que premia la consistencia del usuario con rachas (Streaks),
 * días en verde y opción de barrido de ahorro (Micro-Sweep).
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface, Chip, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { HabitStreak } from '@/src/domain/entities/AtomicHabit';

interface StreakCelebrationBadgeProps {
  streak: HabitStreak;
  dailySurplus?: number;
  onExecuteSweep?: (surplus: number) => void;
}

export const StreakCelebrationBadge: React.FC<StreakCelebrationBadgeProps> = ({
  streak,
  dailySurplus = 0,
  onExecuteSweep,
}) => {
  const theme = useAppTheme();

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.streakRow}>
        <View style={styles.streakInfo}>
          <MaterialCommunityIcons name="fire" size={26} color="#EF4444" />
          <View>
            <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.colors.onSurface }}>
              {streak.currentStreakDays} {streak.currentStreakDays === 1 ? 'Día en Verde' : 'Días en Racha'}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              Récord personal: {streak.bestStreakDays} días • {streak.greenDaysCount} días verdes totales
            </Text>
          </View>
        </View>

        <Chip
          compact
          textStyle={{ color: '#059669', fontWeight: '700', fontSize: 11 }}
          style={{ backgroundColor: '#D1FAE5' }}
        >
          🌿 Consistente
        </Chip>
      </View>

      {/* Si hay excedente diario al final del día y opción de Micro-Sweep */}
      {dailySurplus > 0 && onExecuteSweep && (
        <View style={styles.sweepContainer}>
          <View style={styles.sweepTextContainer}>
            <Text variant="bodySmall" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
              ✨ Excedente de hoy: ${dailySurplus.toLocaleString('es-CO')}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              ¿Mover a tu meta de ahorro con 1 toque?
            </Text>
          </View>
          <Button
            mode="contained-tonal"
            compact
            icon="piggy-bank"
            onPress={() => onExecuteSweep(dailySurplus)}
            labelStyle={{ fontSize: 11, fontWeight: '700' }}
          >
            Ahorrar
          </Button>
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sweepContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  sweepTextContainer: {
    flex: 1,
  },
});
