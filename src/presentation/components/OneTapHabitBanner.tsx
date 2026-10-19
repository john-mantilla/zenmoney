/**
 * ZenMoney — OneTapHabitBanner
 *
 * Banner interactivo para el Dashboard principal que hace visible el hábito en el momento
 * de disparo (Cue) y permite registrarlo en 1 solo toque (2-Minute Rule).
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Surface, Button, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/src/presentation/theme';
import { AtomicHabit } from '@/src/domain/entities/AtomicHabit';

interface OneTapHabitBannerProps {
  habit: AtomicHabit;
  onRegisterOneTap: (habit: AtomicHabit) => Promise<void> | void;
  onAdjustAmount?: (habit: AtomicHabit) => void;
  onSkip?: (habit: AtomicHabit) => void;
}

export const OneTapHabitBanner: React.FC<OneTapHabitBannerProps> = ({
  habit,
  onRegisterOneTap,
  onAdjustAmount,
  onSkip,
}) => {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    setLoading(true);
    try {
      await onRegisterOneTap(habit);
    } finally {
      setLoading(false);
    }
  };

  const amountDisplay = habit.suggestedActionAmount
    ? `$${habit.suggestedActionAmount.toLocaleString('es-CO')}`
    : null;

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color="#F59E0B" />
          <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
            {habit.title}
          </Text>
        </View>
        {onSkip && (
          <IconButton
            icon="close"
            size={16}
            onPress={() => onSkip(habit)}
            accessibilityLabel="Descartar por hoy"
          />
        )}
      </View>

      <Text variant="bodySmall" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
        {habit.type === 'no_spend_day'
          ? '🎯 Hoy es día de cero gasto. Toca para confirmar tu micro-victoria.'
          : habit.merchantName
          ? `Plan habitual en ${habit.merchantName}. Toca para registrarlo en 1 segundo.`
          : 'Micro-hábito activo hoy. Toca para registrar tu cuota.'}
      </Text>

      <View style={styles.actionsRow}>
        <Button
          mode="contained"
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
          icon="check"
          style={styles.mainActionButton}
          contentStyle={{ height: 38 }}
          labelStyle={{ fontWeight: '700' }}
        >
          {amountDisplay ? `Registrar ${amountDisplay}` : 'Confirmar Cumplido'}
        </Button>

        {onAdjustAmount && habit.type !== 'no_spend_day' && (
          <Button
            mode="outlined"
            onPress={() => onAdjustAmount(habit)}
            style={styles.secondaryButton}
            contentStyle={{ height: 38 }}
          >
            Ajustar
          </Button>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  description: {
    marginVertical: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  mainActionButton: {
    borderRadius: 10,
    flex: 1,
  },
  secondaryButton: {
    borderRadius: 10,
  },
});
