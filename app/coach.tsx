/**
 * ZenMoney — Entrenador Financiero & Galería de Insignias (Coach Screen)
 *
 * Espacio de entrenamiento financiero basado en Hábitos Atómicos (James Clear).
 * Permite visualizar el avance de micro-desafíos de 7 días, explorar próximas metas
 * y coleccionar las insignias ganadas por logros reales (Impeccable.style design).
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Text, Surface, IconButton, Avatar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/src/presentation/theme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChallengeCard, MicroCelebrationModal } from '@/src/presentation/components';
import { Evaluate7DayChallenge } from '@/src/domain/usecases/Evaluate7DayChallenge';
import { Challenge } from '@/src/domain/entities/Challenge';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridChallengeRepository } from '@/src/data/repositories/HybridChallengeRepository';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { hapticSuccess } from '@/src/infrastructure/utils/haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { EvaluateBadges, BadgeItem } from '@/src/domain/usecases/EvaluateBadges';

export default function CoachScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuthStore();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);

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
      
      const activeChallengeData = activeCustom || Evaluate7DayChallenge.execute(userTxs, todayStr, userProfile?.id);
      setBadges(EvaluateBadges.execute(userTxs, activeChallengeData));
    } catch (err) {
      console.warn('[Coach Load Error]:', err);
    }
  };


  const handleBadgePress = (badge: BadgeItem) => {
    if (badge.unlocked) {
      hapticSuccess();
      setSelectedBadge(badge);
    }
  };

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Cabecera del Entrenador */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outline + '30',
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12),
          },
        ]}
      >
        <IconButton icon="chevron-down" size={26} onPress={() => router.back()} />
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
            Entrenador Financiero
          </Text>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
            Hábitos Atómicos & Insignias
          </Text>
        </View>
        <View style={styles.headerRightBadge}>
          <MaterialCommunityIcons name="trophy-award" size={20} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.primary }]}>
            {unlockedCount}/{badges.length}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Motivacional Hero con Gradiente */}
        <Surface style={[styles.heroCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <LinearGradient
            colors={[theme.colors.primary + '18', theme.colors.primary + '05']}
            style={styles.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroRow}>
              <View style={[styles.heroIconBadge, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons name="trophy" size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[theme.typography.h3, { fontWeight: '800', color: theme.colors.onSurface }]}>
                  Gimnasio Financiero
                </Text>
                <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                  Micro-desafíos de 7 días basados en victorias de dinero real. Desarrolla hábitos duraderos sin presiones.
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Surface>

        {/* ─── SECCIÓN 1: DESAFÍO ACTIVO DE 7 DÍAS ──────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
            🔥 Desafío Activo de la Semana
          </Text>
        </View>
        {challenge && <ChallengeCard challenge={challenge} />}

        {/* ─── SECCIÓN 2: GALERÍA DE INSIGNIAS GANADAS ───────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
            🏆 Insignias y Logros
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
            {unlockedCount} de {badges.length} desbloqueadas
          </Text>
        </View>

        <View style={styles.badgesGrid}>
          {badges.map((badge) => {
            return (
              <Pressable
                key={badge.id}
                onPress={() => handleBadgePress(badge)}
                style={styles.badgeWrapper}
              >
                <Surface
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: badge.unlocked ? badge.color + '60' : theme.colors.outline + '20',
                      opacity: badge.unlocked ? 1 : 0.6,
                    },
                  ]}
                  elevation={badge.unlocked ? 2 : 0}
                >
                  <View
                    style={[
                      styles.badgeIconCircle,
                      { backgroundColor: badge.unlocked ? badge.color + '20' : theme.colors.surfaceVariant + '80' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={(badge.icon as any) || 'trophy'}
                      size={26}
                      color={badge.unlocked ? badge.color : theme.customColors.textTertiary}
                    />
                  </View>

                  <Text style={[styles.badgeTitle, theme.typography.bodySmall, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                    {badge.title}
                  </Text>
                  <Text style={[styles.badgeSub, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                    {badge.subtitle}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: badge.unlocked ? badge.color + '18' : theme.colors.surfaceVariant },
                    ]}
                  >
                    <Text style={[styles.statusPillText, theme.typography.caption, { color: badge.unlocked ? badge.color : theme.customColors.textTertiary, fontWeight: '700' }]}>
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
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#05966915',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 840 : '100%',
    alignSelf: 'center',
  },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB30',
  },
  heroGradient: {
    padding: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '800',
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
    gap: 12,
  },
  badgeWrapper: {
    width: Platform.OS === 'web' ? '31%' : '48%',
    minWidth: 150,
    flexGrow: 1,
  },
  badgeCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    flex: 1, // Allow it to fill the wrapper flexibly instead of hard 100% which breaks wrapping
  },
  badgeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeTitle: {
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeSub: {
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 'auto',
  },
  statusPillText: {
    fontSize: 10,
  },
});
