/**
 * ZenMoney — ZenHabitsNudgeCard
 *
 * Tarjeta interactiva y amigable que aparece en el Dashboard cuando ZenHabits
 * detecta que es el día habitual de una rutina/hábito financiero (ej: Comer pizza los miércoles)
 * y el usuario aún no lo ha anotado al caer la noche (21:00).
 *
 * Acciones:
 * 1. [Registrar ~$X]: Crea la transacción en 1 toque.
 * 2. [Ajustar]: Abre el formulario pre-llenado para cambiar monto o detalles.
 * 3. [Hoy no salimos / Saltar]: Silencia el recordatorio por hoy.
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Surface, Button, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { HabitPattern } from '@/src/domain/entities/HabitPattern';
import { useHabitStore } from '@/src/infrastructure/state/habitStore';
import { useRouter } from 'expo-router';

interface ZenHabitsNudgeCardProps {
  habit: HabitPattern;
  onRegistered?: () => void;
  onSkipped?: () => void;
}

export const ZenHabitsNudgeCard: React.FC<ZenHabitsNudgeCardProps> = ({
  habit,
  onRegistered,
  onSkipped,
}) => {
  const theme = useAppTheme();
  const router = useRouter();
  const confirmHabit = useHabitStore((s) => s.confirmHabit);
  const skipHabit = useHabitStore((s) => s.skipHabit);

  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await confirmHabit(habit.id);
      if (result.success) {
        onRegistered?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    skipHabit(habit.id);
    onSkipped?.();
  };

  const handleAdjust = () => {
    router.push({
      pathname: '/transaction/new',
      params: {
        mode: 'manual',
        amount: String(habit.estimatedAmount),
        merchant: habit.merchantName || '',
        category: habit.defaultCategoryId,
        account: habit.defaultAccountId || '',
        note: habit.title,
      },
    });
  };

  const merchantOrTitle = habit.merchantName || habit.title;
  const formattedAmount = `$${habit.estimatedAmount.toLocaleString('es-CO')}`;

  return (
    <Surface
      elevation={2}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.primary + '35',
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name={(habit.icon as any) || 'pizza'}
            size={24}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.titleContainer}>
          <View style={styles.tagRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.colors.primary + '18' },
              ]}
            >
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.primary, fontWeight: '700', fontSize: 11 },
                ]}
              >
                ZenHabits • Hábitos y Rutinas
              </Text>
            </View>
          </View>
          <Text
            style={[
              theme.typography.body,
              { fontWeight: '700', color: theme.colors.onSurface, marginTop: 2 },
            ]}
          >
            ¿Salieron hoy a {merchantOrTitle}?
          </Text>
        </View>

        <IconButton
          icon="close"
          size={18}
          iconColor={theme.customColors.textSecondary}
          onPress={handleSkip}
          style={{ margin: 0 }}
        />
      </View>

      <Text
        style={[
          theme.typography.bodySmall,
          {
            color: theme.customColors.textSecondary,
            marginHorizontal: 12,
            marginTop: 4,
            lineHeight: 18,
          },
        ]}
      >
        Los miércoles suele ser día de {merchantOrTitle} con la familia (~{formattedAmount}).
        ¿Quieres registrarlo para mantener tus finanzas al día?
      </Text>

      {/* Acciones */}
      <View style={styles.actionsRow}>
        <Button
          mode="text"
          compact
          textColor={theme.customColors.textSecondary}
          onPress={handleSkip}
          style={styles.actionBtn}
          labelStyle={{ fontSize: 12 }}
        >
          Hoy no salimos
        </Button>

        <Button
          mode="text"
          compact
          textColor={theme.colors.primary}
          onPress={handleAdjust}
          style={styles.actionBtn}
          labelStyle={{ fontSize: 12 }}
        >
          Ajustar
        </Button>

        <Button
          mode="contained"
          compact
          loading={loading}
          disabled={loading}
          onPress={handleConfirm}
          buttonColor={theme.colors.primary}
          textColor="#FFFFFF"
          style={[styles.confirmBtn, { borderRadius: 10 }]}
          labelStyle={{ fontWeight: '700', fontSize: 13 }}
        >
          {`Registrar ${formattedAmount}`}
        </Button>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  actionBtn: {
    borderRadius: 8,
  },
  confirmBtn: {
    paddingHorizontal: 6,
  },
});
