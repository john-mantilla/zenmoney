/**
 * ZenMoney — Componente ChallengeCard (Visualización de Micro-Desafíos de 7 Días)
 *
 * Muestra el progreso diario del desafío de 7 días con 7 nodos circulares interactivos,
 * basado en Hábitos Atómicos (James Clear) para fomentar pequeñas victorias de identidad.
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { Challenge } from '@/src/domain/entities/Challenge';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface ChallengeCardProps {
  challenge: Challenge;
  onPress?: () => void;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onPress }) => {
  const theme = useAppTheme();

  const isCompletedAll = challenge.status === 'completed';
  const mainColor = isCompletedAll ? '#059669' : '#F97316'; // Esmeralda si completó, Naranja Fuego si activo
  const bgBadge = mainColor + '15';

  return (
    <Surface
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: mainColor + '35',
        },
      ]}
    >
      <Pressable onPress={onPress}>
        {/* Cabecera del Desafío */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <View style={[styles.iconCircle, { backgroundColor: mainColor + '20' }]}>
              <MaterialCommunityIcons
                name={(challenge.icon as any) || 'fire'}
                size={22}
                color={mainColor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                {challenge.title}
              </Text>
              <Text style={[styles.subtitle, { color: theme.customColors.textSecondary }]}>
                Ciclo de 7 días • Hábitos Atómicos
              </Text>
            </View>
          </View>

          <View style={[styles.badge, { backgroundColor: bgBadge }]}>
            <Text style={[styles.badgeText, { color: mainColor }]}>
              {challenge.completedDays} / {challenge.targetDays} días
            </Text>
          </View>
        </View>

        {/* Fila de 7 Nodos Diarios (Días 1 al 7) */}
        <View style={styles.daysTrackRow}>
          {challenge.days.map((day) => {
            let nodeBg = theme.colors.surfaceVariant;
            let nodeBorder = 'transparent';
            let iconOrText: React.ReactNode = (
              <Text style={[styles.dayNumberText, { color: theme.customColors.textSecondary }]}>
                {day.dayNumber}
              </Text>
            );

            if (day.isCompleted) {
              nodeBg = mainColor;
              iconOrText = <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />;
            } else if (day.isToday) {
              nodeBorder = mainColor;
              nodeBg = mainColor + '20';
              iconOrText = (
                <Text style={[styles.dayNumberText, { color: mainColor, fontWeight: '800' }]}>
                  {day.dayNumber}
                </Text>
              );
            }

            return (
              <View key={day.date} style={styles.nodeContainer}>
                <View
                  style={[
                    styles.dayNode,
                    {
                      backgroundColor: nodeBg,
                      borderColor: nodeBorder,
                      borderWidth: day.isToday && !day.isCompleted ? 2 : 0,
                    },
                  ]}
                >
                  {iconOrText}
                </View>
                <Text style={[styles.dayLabel, { color: day.isToday ? mainColor : theme.customColors.textSecondary, fontWeight: day.isToday ? '700' : '400' }]}>
                  {day.isToday ? 'Hoy' : `D${day.dayNumber}`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Pie Motivacional de Impacto */}
        <View style={[styles.footerBox, { backgroundColor: mainColor + '10' }]}>
          <Text style={[styles.footerText, { color: mainColor }]}>
            {isCompletedAll
              ? `🎉 ¡Felicitaciones! Completaste los 7 días consecutivos. Ganaste la insignia "${challenge.rewardBadgeTitle}".`
              : challenge.completedDays === 6
              ? '🔥 ¡Solo te falta 1 día para lograr la semana perfecta! Registra hoy y completa el reto.'
              : `💪 Vas en el día ${challenge.completedDays} de 7. Mantén el ritmo para asegurar tu hábito.`}
          </Text>
        </View>
      </Pressable>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginVertical: 12,
    elevation: 3,
    boxShadow: '0px 4px 16px rgba(0,0,0,0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  daysTrackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  nodeContainer: {
    alignItems: 'center',
  },
  dayNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayNumberText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dayLabel: {
    fontSize: 10,
  },
  footerBox: {
    padding: 10,
    borderRadius: 12,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center',
  },
});
