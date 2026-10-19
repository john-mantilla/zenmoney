/**
 * ZenMoney — DailySafeToSpendCard
 *
 * Muestra al usuario su disponible diario recomendado en tiempo real (Safe-to-Spend)
 * para tomar micro-decisiones conscientes, con velocímetro de ritmo y respeto total
 * por la configuración de activación/desactivación del usuario.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface, ProgressBar, Chip } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { DailyPacing } from '@/src/domain/entities/AtomicHabit';
import { useHabitSettingsStore } from '@/src/infrastructure/state/habitSettingsStore';

interface DailySafeToSpendCardProps {
  pacing: DailyPacing;
  categoryName?: string;
  onPressSettings?: () => void;
  onPressDetails?: () => void;
}

export const DailySafeToSpendCard: React.FC<DailySafeToSpendCardProps> = ({
  pacing,
  categoryName = 'Presupuesto Discrecional',
  onPressSettings,
  onPressDetails,
}) => {
  const theme = useAppTheme();
  const isGloballyEnabled = useHabitSettingsStore((s) => s.settings.isGloballyEnabled);
  const isCategoryActive = useHabitSettingsStore((s) => s.isCategoryActive(pacing.categoryId));

  const isEnabled = isGloballyEnabled && isCategoryActive;

  if (!isEnabled) {
    return (
      <Surface style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
        <View style={styles.disabledContainer}>
          <MaterialCommunityIcons name="speedometer-slow" size={24} color={theme.colors.outline} />
          <View style={styles.disabledTextContainer}>
            <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>
              Hábitos Atómicos pausados
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              {categoryName}: modo presupuesto mensual tradicional activo.
            </Text>
          </View>
          {onPressSettings && (
            <TouchableOpacity onPress={onPressSettings} style={styles.activateButton}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                Activar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Surface>
    );
  }

  // Progreso del disponible de hoy (cuánto se ha consumido del Safe-to-Spend diario)
  const spentRatio = pacing.dailySafeToSpend > 0
    ? Math.min(1, pacing.spentToday / pacing.dailySafeToSpend)
    : 1;

  const getPacingChip = () => {
    switch (pacing.pacingStatus) {
      case 'ahead':
        return { label: '🌟 Ritmo con Superávit', color: '#10B981' };
      case 'on_track':
        return { label: '🌿 En Ritmo', color: '#059669' };
      case 'accelerated':
        return { label: '⚡ Ritmo Acelerado', color: '#F59E0B' };
      case 'exhausted':
        return { label: '🛑 Presupuesto Agotado', color: '#EF4444' };
      default:
        return { label: 'En Ritmo', color: theme.colors.primary };
    }
  };

  const chip = getPacingChip();

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <TouchableOpacity onPress={onPressDetails} activeOpacity={0.8}>
        {/* Cabecera */}
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <MaterialCommunityIcons
              name={pacing.isWeekend ? 'weather-sunset' : 'calendar-today'}
              size={18}
              color={theme.colors.primary}
            />
            <Text variant="labelLarge" style={[styles.categoryTitle, { color: theme.colors.onSurfaceVariant }]}>
              {categoryName} {pacing.isWeekend ? '(Fin de semana)' : ''}
            </Text>
          </View>
          <Chip
            compact
            textStyle={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}
            style={{ backgroundColor: chip.color, height: 24 }}
          >
            {chip.label}
          </Chip>
        </View>

        {/* Monto Principal Disponible Hoy */}
        <View style={styles.amountSection}>
          <Text variant="headlineMedium" style={[styles.amountText, { color: theme.colors.onSurface }]}>
            ${pacing.remainingToday.toLocaleString('es-CO')}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            disponible para hoy (cuota base: ${pacing.dailySafeToSpend.toLocaleString('es-CO')})
          </Text>
        </View>

        {/* Barra de progreso de hoy */}
        <View style={styles.progressSection}>
          <ProgressBar
            progress={spentRatio}
            color={spentRatio >= 1 ? '#EF4444' : theme.colors.primary}
            style={styles.progressBar}
          />
          <View style={styles.progressLabels}>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              Gastado hoy: ${pacing.spentToday.toLocaleString('es-CO')}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              Restan {pacing.daysRemainingInMonth} días del mes
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryTitle: {
    fontWeight: '600',
  },
  amountSection: {
    marginVertical: 4,
  },
  amountText: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  progressSection: {
    marginTop: 10,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  disabledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  disabledTextContainer: {
    flex: 1,
  },
  activateButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
