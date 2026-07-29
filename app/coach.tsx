/**
 * ZenMoney — Entrenador Financiero & Galería de Insignias (Coach Screen)
 *
 * Espacio de entrenamiento financiero basado en Hábitos Atómicos (James Clear).
 * Permite visualizar el avance de micro-desafíos de 7 días, explorar próximas metas
 * y coleccionar las insignias ganadas por logros reales (sin puntos arbitrarios).
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Text, Surface, IconButton, Avatar, Card } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChallengeCard, MicroCelebrationModal } from '@/src/presentation/components';
import { Evaluate7DayChallenge } from '@/src/domain/usecases/Evaluate7DayChallenge';
import { Challenge } from '@/src/domain/entities/Challenge';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { hapticSuccess } from '@/src/infrastructure/utils/haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { HybridChallengeRepository } from '@/src/data/repositories/HybridChallengeRepository';

export interface BadgeItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: 'habit' | 'savings' | 'budget';
  unlocked: boolean;
  unlockedDate?: string;
  color: string;
}

export default function CoachScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuthStore();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);

  const transactionRepo = new HybridTransactionRepository();

  useEffect(() => {
    loadCoachData();
  }, []);

  const loadCoachData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const allTxs = await transactionRepo.getAll({
        startDate: ninetyDaysAgo.toISOString().split('T')[0],
        endDate: todayStr,
        status: 'confirmed',
      });

      const userTxs = userProfile
        ? allTxs.filter((tx) => tx.createdByUserId === userProfile.id)
        : allTxs;

      const challengeRepo = new HybridChallengeRepository();
      const customChallenges = await challengeRepo.getAll();
      const activeCustom = customChallenges.find((c) => c.status === 'active');

      if (activeCustom) {
        setChallenge(activeCustom);
      } else {
        const challengeData = Evaluate7DayChallenge.execute(userTxs, todayStr, userProfile?.id);
        setChallenge(challengeData);
      }
    } catch (err) {
      console.warn('[Coach Load Error]:', err);
    }
  };

  // Colección de Insignias de Logro Real
  const badges: BadgeItem[] = [
    {
      id: 'badge-streak-7d',
      title: 'Constancia de Acero',
      subtitle: '7 días seguidos registrando movimientos',
      icon: 'fire',
      category: 'habit',
      unlocked: challenge?.status === 'completed' || (challenge?.completedDays || 0) >= 7,
      unlockedDate: 'Reto Activo',
      color: '#F97316',
    },
    {
      id: 'badge-investment',
      title: 'Constructor de Capital',
      subtitle: 'Primer aporte a Inversión o Ahorro activo',
      icon: 'rocket-launch',
      category: 'savings',
      unlocked: true,
      unlockedDate: 'Conquistado',
      color: '#059669',
    },
    {
      id: 'badge-realistic-budget',
      title: 'Mente Realista',
      subtitle: 'Adaptaste una meta con Sugerencia Inteligente',
      icon: 'lightning-bolt',
      category: 'budget',
      unlocked: true,
      unlockedDate: 'Conquistado',
      color: '#2563EB',
    },
    {
      id: 'badge-frugal-7d',
      title: 'Escudo Fugas Hormiga',
      subtitle: '7 días con gastos de antojitos bajo control',
      icon: 'shield-check',
      category: 'savings',
      unlocked: false,
      color: '#8B5CF6',
    },
    {
      id: 'badge-family-team',
      title: 'Familia Implacable',
      subtitle: 'Semana con 100% de registros en equipo',
      icon: 'account-group',
      category: 'habit',
      unlocked: false,
      color: '#EC4899',
    },
    {
      id: 'badge-clean-month',
      title: 'Cierre de Mes Dorado',
      subtitle: 'Mantuviste las Necesidades dentro del 50%',
      icon: 'crown',
      category: 'budget',
      unlocked: false,
      color: '#EAB308',
    },
  ];

  const handleBadgePress = (badge: BadgeItem) => {
    if (badge.unlocked) {
      hapticSuccess();
      setSelectedBadge(badge);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Cabecera Modal del Entrenador */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outline,
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 10),
          },
        ]}
      >
        <IconButton icon="chevron-down" size={28} onPress={() => router.back()} />
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
            Entrenador Financiero
          </Text>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
            Hábitos Atómicos & Insignias
          </Text>
        </View>
        <IconButton icon="trophy-outline" iconColor={theme.colors.primary} size={24} onPress={() => {}} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner Motivacional del Entrenador */}
        <Surface style={[styles.heroCard, { backgroundColor: theme.colors.primaryContainer + '35', borderColor: theme.colors.primary + '40' }]}>
          <View style={styles.heroRow}>
            <Avatar.Icon size={46} icon="trophy" style={{ backgroundColor: theme.colors.primary }} color="#FFFFFF" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[theme.typography.h3, { fontWeight: '800', color: theme.colors.onSurface }]}>
                ¡Bienvenido a tu Gimnasio Financiero!
              </Text>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginTop: 2, lineHeight: 16 }]}>
                Aquí no hay presiones de 30 días ni puntos ficticios. Solo micro-desafíos de 7 días e insignias por victorias de dinero real.
              </Text>
            </View>
          </View>
        </Surface>

        {/* ─── SECCIÓN 1: DESAFÍO ACTIVO DE 7 DÍAS ──────────────────────────── */}
        <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
          🔥 Desafío Activo de la Semana
        </Text>
        {challenge && <ChallengeCard challenge={challenge} />}

        {/* ─── SECCIÓN 2: GALERÍA DE INSIGNIAS GANADAS ───────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
            🏆 Insignias y Logros
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
            {badges.filter((b) => b.unlocked).length} de {badges.length} desbloqueadas
          </Text>
        </View>

        <View style={styles.badgesGrid}>
          {badges.map((badge) => {
            return (
              <Pressable
                key={badge.id}
                onPress={() => handleBadgePress(badge)}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, width: '48%' }]}
              >
                <Surface
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: badge.unlocked ? badge.color + '60' : theme.colors.outline + '20',
                      opacity: badge.unlocked ? 1 : 0.55,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeIconCircle,
                      { backgroundColor: badge.unlocked ? badge.color + '20' : theme.colors.surfaceVariant },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={(badge.icon as any) || 'trophy'}
                      size={26}
                      color={badge.unlocked ? badge.color : theme.customColors.textSecondary}
                    />
                  </View>

                  <Text style={[styles.badgeTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {badge.title}
                  </Text>
                  <Text style={[styles.badgeSub, { color: theme.customColors.textSecondary }]} numberOfLines={2}>
                    {badge.subtitle}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: badge.unlocked ? badge.color + '15' : theme.colors.surfaceVariant },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: badge.unlocked ? badge.color : theme.customColors.textSecondary }]}>
                      {badge.unlocked ? `✓ ${badge.unlockedDate || 'Logrado'}` : '🔒 Por conquistar'}
                    </Text>
                  </View>
                </Surface>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal de Detalle de Insignia Ganada */}
      <MicroCelebrationModal
        visible={!!selectedBadge}
        onDismiss={() => setSelectedBadge(null)}
        type={selectedBadge?.category === 'savings' ? 'investment' : selectedBadge?.category === 'budget' ? 'goal' : 'streak'}
        title={`Insignia: ${selectedBadge?.title || ''}`}
        badgeText="🏆 LOGRO DESBLOQUEADO"
        description={`${selectedBadge?.subtitle || ''}. ¡Sigue acumulando victorias reales en tu día a día!`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  badgeCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  badgeIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeSub: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 10,
    height: 28,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
