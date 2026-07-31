/**
 * ZenMoney — Modal de Salud Financiera & Framework de Metodologías
 *
 * Muestra el análisis de salud financiera por pilar (Necesidades, Deseos, Ahorro, Caridad)
 * con diseño de alto impacto visual (Impeccable.style), tipografía Plus Jakarta Sans,
 * responsive web/mobile y soporte para Dark/Light mode.
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Modal, TouchableOpacity, Platform, Pressable, TouchableWithoutFeedback } from 'react-native';
import { Surface, Text, Button, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/presentation/theme';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { Account } from '@/src/domain/entities/Account';
import { FinancialMethodology } from '@/src/domain/entities/FinancialMethodology';
import { CalculateFinancialHealth } from '@/src/domain/usecases/CalculateFinancialHealth';

interface FinancialHealthModalProps {
  visible: boolean;
  onDismiss: () => void;
  transactions: Transaction[];
  categories: Category[];
  accounts?: Account[];
}

const PRESET_METHODOLOGIES: (FinancialMethodology & { icon: string; badgeColor: string })[] = [
  {
    id: 'p1',
    familyGroupId: null,
    name: '50/30/20',
    code: 'rule_50_30_20',
    description: '50% Necesidades / 30% Deseos / 20% Ahorros',
    isPreset: true,
    targets: { needs: 50, wants: 30, savings: 20 },
    isActive: true,
    createdAt: '',
    icon: 'scale-balance',
    badgeColor: '#2E7D5F',
  },
  {
    id: 'p2',
    familyGroupId: null,
    name: '70/20/10',
    code: 'rule_70_20_10',
    description: '70% Gastos / 20% Ahorros / 10% Caridad',
    isPreset: true,
    targets: { needs: 70, savings: 20, charity: 10 },
    isActive: false,
    createdAt: '',
    icon: 'heart-outline',
    badgeColor: '#8B5CF6',
  },
  {
    id: 'p3',
    familyGroupId: null,
    name: '60/20/20',
    code: 'rule_60_20_20',
    description: '60% Fijos / 20% Deseos / 20% Ahorros',
    isPreset: true,
    targets: { needs: 60, wants: 20, savings: 20 },
    isActive: false,
    createdAt: '',
    icon: 'shield-check-outline',
    badgeColor: '#3B82F6',
  },
  {
    id: 'p4',
    familyGroupId: null,
    name: 'FIRE',
    code: 'rule_fire',
    description: '50% Gastos / 50% Ahorro & Inversión Agresiva',
    isPreset: true,
    targets: { needs: 50, savings: 50 },
    isActive: false,
    createdAt: '',
    icon: 'fire',
    badgeColor: '#F59E0B',
  },
];

const TargetProgressBar: React.FC<{ actual: number; target: number; color: string }> = ({
  actual,
  target,
  color,
}) => {
  const theme = useAppTheme();
  const cappedActual = Math.min(Math.max(actual, 0), 100);
  const cappedTarget = Math.min(Math.max(target, 0), 100);

  return (
    <View style={{ marginVertical: 10 }}>
      {/* Contenedor de la barra de progreso */}
      <View
        style={{
          height: 14,
          backgroundColor: theme.colors.surfaceVariant + '80',
          borderRadius: 8,
          width: '100%',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Relleno de consumo real */}
        <View
          style={{
            height: '100%',
            width: `${cappedActual}%`,
            backgroundColor: color,
            borderRadius: 8,
          }}
        />

        {/* Marcador vertical visible de la Meta */}
        <View
          style={{
            position: 'absolute',
            left: `${cappedTarget}%`,
            top: -5,
            bottom: -5,
            width: 4,
            backgroundColor: theme.colors.onSurface,
            borderRadius: 2,
            zIndex: 10,
            transform: [{ translateX: -2 }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 4,
          }}
        />
      </View>

      {/* Referencias visuales */}
      <View style={{ position: 'relative', height: 20, marginTop: 6 }}>
        <Text style={[theme.typography.caption, { position: 'absolute', left: 0, fontSize: 11, color: theme.customColors.textTertiary }]}>
          0%
        </Text>

        <View
          style={{
            position: 'absolute',
            left: `${cappedTarget}%`,
            transform: [{ translateX: -45 }],
            alignItems: 'center',
          }}
        >
          <Text style={[theme.typography.caption, { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface }]}>
            📍 Meta: {target}%
          </Text>
        </View>

        <Text style={[theme.typography.caption, { position: 'absolute', right: 0, fontSize: 11, color: theme.customColors.textTertiary }]}>
          100%
        </Text>
      </View>
    </View>
  );
};

export const FinancialHealthModal: React.FC<FinancialHealthModalProps> = ({
  visible,
  onDismiss,
  transactions,
  categories,
  accounts = [],
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [selectedCode, setSelectedCode] = useState<string>('rule_50_30_20');

  const selectedMethodology = useMemo(() => {
    return PRESET_METHODOLOGIES.find((m) => m.code === selectedCode) || PRESET_METHODOLOGIES[0];
  }, [selectedCode]);

  const healthData = useMemo(() => {
    return CalculateFinancialHealth.execute(transactions, categories, selectedMethodology, accounts);
  }, [transactions, categories, selectedMethodology, accounts]);

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_) {}
  };

  const formatCurrency = (val: number) => {
    return `$${Math.abs(Math.round(val)).toLocaleString('es-CO')}`;
  };

  const baseAmount = healthData.totalIncome > 0 ? healthData.totalIncome : healthData.totalExpense;

  // Evaluar estado para Necesidades
  const getNeedsStatus = (actual: number, target: number) => {
    if (actual <= target + 3) {
      return { label: '✅ Dentro del rango', color: '#059669', bg: '#05966918' };
    }
    const diff = (baseAmount * (actual - target)) / 100;
    return { label: `⚠️ Excedido (+${formatCurrency(diff)})`, color: '#DC2626', bg: '#DC262618' };
  };

  // Evaluar estado para Deseos
  const getWantsStatus = (actual: number, target: number) => {
    if (actual <= target + 2) {
      return { label: '✅ Dentro del rango', color: '#059669', bg: '#05966918' };
    }
    const diff = (baseAmount * (actual - target)) / 100;
    return { label: `⚠️ Excedido (+${formatCurrency(diff)})`, color: '#D97706', bg: '#D9770618' };
  };

  // Evaluar estado para Ahorros
  const getSavingsStatus = (actual: number, target: number) => {
    if (actual >= target - 2) {
      return { label: '✅ Target cumplido', color: '#059669', bg: '#05966918' };
    }
    const diff = (baseAmount * (target - actual)) / 100;
    return { label: `⚠️ Te faltan ${formatCurrency(diff)}`, color: '#2563EB', bg: '#2563EB18' };
  };

  // Evaluar estado para Caridad
  const getCharityStatus = (actual: number, target: number) => {
    if (actual >= target - 1) {
      return { label: '✅ Target cumplido', color: '#059669', bg: '#05966918' };
    }
    const diff = (baseAmount * (target - actual)) / 100;
    return { label: `⚠️ Te faltan ${formatCurrency(diff)}`, color: '#059669', bg: '#05966918' };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Surface
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.colors.surface,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
              elevation={5}
            >
              {/* Drag handle bar */}
              <View style={styles.dragHandleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: theme.colors.outline + '40' }]} />
              </View>

              {/* Cabecera */}
              <View style={styles.headerRow}>
                <View style={styles.headerTitleContainer}>
                  <View style={[styles.headerIconBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                    <MaterialCommunityIcons name="heart-pulse" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                      Salud Financiera
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      {selectedMethodology.name} • {selectedMethodology.description}
                    </Text>
                  </View>
                </View>
                <IconButton icon="close" size={20} onPress={onDismiss} style={{ margin: 0 }} />
              </View>

              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* SELECTOR DE METODOLOGÍA SUPERIOR (Pills Impeccable) */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                    METODOLOGÍA FINANCIERA
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    {PRESET_METHODOLOGIES.map((m) => {
                      const isSelected = selectedCode === m.code;
                      return (
                        <Pressable
                          key={m.code}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedCode(m.code);
                          }}
                          style={[
                            styles.methodologyPill,
                            {
                              borderColor: isSelected ? theme.colors.primary : theme.colors.outline + '30',
                              backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={m.icon as any}
                            size={18}
                            color={isSelected ? theme.colors.primary : theme.customColors.textSecondary}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              theme.typography.button,
                              {
                                fontSize: 13,
                                color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {m.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* TARJETA 1: Necesidades Básicas */}
                {selectedMethodology.targets.needs !== undefined && (() => {
                  const target = selectedMethodology.targets.needs!;
                  const actual = healthData.actualPercentages.needs;
                  const status = getNeedsStatus(actual, target);

                  return (
                    <Surface
                      style={[
                        styles.pillarCard,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '25' },
                      ]}
                      elevation={1}
                    >
                      <View style={styles.pillarHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialCommunityIcons name="home-city-outline" size={20} color={theme.colors.primary} />
                          <Text style={[theme.typography.h4, { fontWeight: '700', color: theme.colors.onSurface }]}>
                            Necesidades Básicas
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: status.bg }]}>
                          <Text style={[theme.typography.caption, { fontSize: 11, fontWeight: '700', color: status.color }]}>
                            {status.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.valueRow}>
                        <Text style={[theme.typography.amount, { color: theme.colors.onSurface, fontSize: 24 }]}>
                          Real: {actual}%
                        </Text>
                        <Text style={[theme.typography.amountSmall, { color: theme.customColors.textSecondary }]}>
                          {formatCurrency(healthData.actualAmounts.needs)}
                        </Text>
                      </View>

                      <TargetProgressBar actual={actual} target={target} color={status.color} />
                    </Surface>
                  );
                })()}

                {/* TARJETA 2: Deseos & Estilo de Vida */}
                {selectedMethodology.targets.wants !== undefined && (() => {
                  const target = selectedMethodology.targets.wants!;
                  const actual = healthData.actualPercentages.wants;
                  const status = getWantsStatus(actual, target);

                  return (
                    <Surface
                      style={[
                        styles.pillarCard,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '25' },
                      ]}
                      elevation={1}
                    >
                      <View style={styles.pillarHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialCommunityIcons name="palette-outline" size={20} color="#D97706" />
                          <Text style={[theme.typography.h4, { fontWeight: '700', color: theme.colors.onSurface }]}>
                            Deseos & Estilo de Vida
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: status.bg }]}>
                          <Text style={[theme.typography.caption, { fontSize: 11, fontWeight: '700', color: status.color }]}>
                            {status.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.valueRow}>
                        <Text style={[theme.typography.amount, { color: theme.colors.onSurface, fontSize: 24 }]}>
                          Real: {actual}%
                        </Text>
                        <Text style={[theme.typography.amountSmall, { color: theme.customColors.textSecondary }]}>
                          {formatCurrency(healthData.actualAmounts.wants)}
                        </Text>
                      </View>

                      <TargetProgressBar actual={actual} target={target} color={status.color} />
                    </Surface>
                  );
                })()}

                {/* TARJETA 3: Ahorros e Inversión */}
                {selectedMethodology.targets.savings !== undefined && (() => {
                  const target = selectedMethodology.targets.savings!;
                  const actual = healthData.actualPercentages.savings;
                  const status = getSavingsStatus(actual, target);

                  return (
                    <Surface
                      style={[
                        styles.pillarCard,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '25' },
                      ]}
                      elevation={1}
                    >
                      <View style={styles.pillarHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialCommunityIcons name="piggy-bank-outline" size={20} color="#059669" />
                          <Text style={[theme.typography.h4, { fontWeight: '700', color: theme.colors.onSurface }]}>
                            Ahorros & Inversión
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: status.bg }]}>
                          <Text style={[theme.typography.caption, { fontSize: 11, fontWeight: '700', color: status.color }]}>
                            {status.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.valueRow}>
                        <Text style={[theme.typography.amount, { color: theme.colors.onSurface, fontSize: 24 }]}>
                          Real: {actual}%
                        </Text>
                        <Text style={[theme.typography.amountSmall, { color: theme.customColors.textSecondary }]}>
                          {formatCurrency(healthData.actualAmounts.savings)}
                        </Text>
                      </View>

                      <TargetProgressBar actual={actual} target={target} color={status.color} />
                    </Surface>
                  );
                })()}

                {/* TARJETA 4: Caridad & Donaciones (para 70/20/10) */}
                {selectedMethodology.targets.charity !== undefined && (() => {
                  const target = selectedMethodology.targets.charity!;
                  const actual = healthData.actualPercentages.charity;
                  const status = getCharityStatus(actual, target);

                  return (
                    <Surface
                      style={[
                        styles.pillarCard,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '25' },
                      ]}
                      elevation={1}
                    >
                      <View style={styles.pillarHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialCommunityIcons name="heart-handshake-outline" size={20} color="#8B5CF6" />
                          <Text style={[theme.typography.h4, { fontWeight: '700', color: theme.colors.onSurface }]}>
                            Caridad & Donaciones
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: status.bg }]}>
                          <Text style={[theme.typography.caption, { fontSize: 11, fontWeight: '700', color: status.color }]}>
                            {status.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.valueRow}>
                        <Text style={[theme.typography.amount, { color: theme.colors.onSurface, fontSize: 24 }]}>
                          Real: {actual}%
                        </Text>
                        <Text style={[theme.typography.amountSmall, { color: theme.customColors.textSecondary }]}>
                          {formatCurrency(healthData.actualAmounts.charity)}
                        </Text>
                      </View>

                      <TargetProgressBar actual={actual} target={target} color={status.color} />
                    </Surface>
                  );
                })()}

                {/* Observaciones del Sistema */}
                {healthData.recommendations.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                      OBSERVACIONES DEL SISTEMA
                    </Text>
                    {healthData.recommendations.map((rec, idx) => (
                      <View key={idx} style={[styles.recCard, { backgroundColor: theme.colors.surfaceVariant + '50' }]}>
                        <MaterialCommunityIcons
                          name="lightbulb-on-outline"
                          size={20}
                          color={theme.colors.primary}
                          style={{ marginRight: 10, marginTop: 2 }}
                        />
                        <Text style={[theme.typography.bodySmall, { flex: 1, color: theme.colors.onSurface, lineHeight: 20 }]}>
                          {rec}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </Surface>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  modalCard: {
    borderRadius: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 660 : '100%',
    maxHeight: Platform.OS === 'web' ? ('85vh' as any) : '90%',
    paddingHorizontal: 20,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    marginBottom: 6,
  },
  methodologyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 8,
  },
  pillarCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  pillarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  recCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
});
