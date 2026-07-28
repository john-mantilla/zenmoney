/**
 * ZenMoney — Modal de Salud Financiera & Framework de Metodologías
 *
 * Muestra las tarjetas estructuradas por pilar (Necesidades, Deseos, Ahorro, Caridad)
 * con barra comparativa de consumo real vs marcador vertical de Meta (Target).
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { Surface, Text, Button, IconButton, Chip } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { FinancialMethodology, BudgetRole } from '@/src/domain/entities/FinancialMethodology';
import { CalculateFinancialHealth } from '@/src/domain/usecases/CalculateFinancialHealth';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface FinancialHealthModalProps {
  visible: boolean;
  onDismiss: () => void;
  transactions: Transaction[];
  categories: Category[];
}

const PRESET_METHODOLOGIES: FinancialMethodology[] = [
  {
    id: 'p1',
    familyGroupId: null,
    name: '50/30/20 (Elizabeth Warren)',
    code: 'rule_50_30_20',
    description: '50% Necesidades Básicas / 30% Deseos / 20% Ahorros',
    isPreset: true,
    targets: { needs: 50, wants: 30, savings: 20 },
    isActive: true,
    createdAt: '',
  },
  {
    id: 'p2',
    familyGroupId: null,
    name: '70/20/10 (Mente Millonaria)',
    code: 'rule_70_20_10',
    description: '70% Gastos de Vida / 20% Ahorros / 10% Caridad',
    isPreset: true,
    targets: { needs: 70, savings: 20, charity: 10 },
    isActive: false,
    createdAt: '',
  },
  {
    id: 'p3',
    familyGroupId: null,
    name: '60/20/20 (Presupuesto Tradicional)',
    code: 'rule_60_20_20',
    description: '60% Gastos Fijos / 20% Deseos / 20% Ahorros',
    isPreset: true,
    targets: { needs: 60, wants: 20, savings: 20 },
    isActive: false,
    createdAt: '',
  },
  {
    id: 'p4',
    familyGroupId: null,
    name: 'FIRE (Independencia Financiera)',
    code: 'rule_fire',
    description: '50% Gastos / 50% Ahorro & Inversión Agresiva',
    isPreset: true,
    targets: { needs: 50, savings: 50 },
    isActive: false,
    createdAt: '',
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
    <View style={{ marginVertical: 8 }}>
      {/* Contenedor de la barra de progreso */}
      <View
        style={{
          height: 12,
          backgroundColor: theme.colors.surfaceVariant + '80',
          borderRadius: 6,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Relleno de consumo real */}
        <View
          style={{
            height: '100%',
            width: `${cappedActual}%`,
            backgroundColor: color,
            borderRadius: 6,
          }}
        />

        {/* Marcador vertical visible de la Meta */}
        <View
          style={{
            position: 'absolute',
            left: `${cappedTarget}%`,
            top: -4,
            bottom: -4,
            width: 4,
            backgroundColor: '#0F172A',
            borderRadius: 2,
            zIndex: 10,
            transform: [{ translateX: -2 }],
            boxShadow: '0px 0px 4px rgba(0,0,0,0.3)',
          }}
        />
      </View>

      {/* Referencias visuales con la Meta alineada exactamente debajo del marcador vertical */}
      <View style={{ position: 'relative', height: 18, marginTop: 4 }}>
        <Text style={{ position: 'absolute', left: 0, fontSize: 10, color: theme.customColors.textSecondary }}>
          0%
        </Text>

        <View
          style={{
            position: 'absolute',
            left: `${cappedTarget}%`,
            transform: [{ translateX: -40 }],
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.onSurface }}>
            📍 Marcador Meta: {target}%
          </Text>
        </View>

        <Text style={{ position: 'absolute', right: 0, fontSize: 10, color: theme.customColors.textSecondary }}>
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
}) => {
  const theme = useAppTheme();
  const [selectedCode, setSelectedCode] = useState<string>('rule_50_30_20');

  const selectedMethodology = useMemo(() => {
    return PRESET_METHODOLOGIES.find((m) => m.code === selectedCode) || PRESET_METHODOLOGIES[0];
  }, [selectedCode]);

  const healthData = useMemo(() => {
    return CalculateFinancialHealth.execute(transactions, categories, selectedMethodology);
  }, [transactions, categories, selectedMethodology]);

  const formatCurrency = (val: number) => {
    return `$${Math.abs(Math.round(val)).toLocaleString('es-CO')}`;
  };

  // Evaluar estado para Necesidades
  const getNeedsStatus = (actual: number, target: number) => {
    if (actual <= target + 3) {
      return { label: '✅ Dentro del rango', color: '#059669', bg: '#05966915' };
    }
    const diff = (healthData.totalExpense * (actual - target)) / 100;
    return { label: `⚠️ Excedido (+${formatCurrency(diff)})`, color: '#DC2626', bg: '#DC262615' };
  };

  // Evaluar estado para Deseos
  const getWantsStatus = (actual: number, target: number) => {
    if (actual <= target + 2) {
      return { label: '✅ Dentro del rango', color: '#059669', bg: '#05966915' };
    }
    const diff = (healthData.totalExpense * (actual - target)) / 100;
    return { label: `⚠️ Excedido (+${formatCurrency(diff)})`, color: '#D97706', bg: '#D9770615' };
  };

  // Evaluar estado para Ahorros
  const getSavingsStatus = (actual: number, target: number) => {
    if (actual >= target - 2) {
      return { label: '✅ Target cumplido', color: '#059669', bg: '#05966915' };
    }
    const diff = (healthData.totalExpense * (target - actual)) / 100;
    return { label: `⚠️ Te faltan ${formatCurrency(diff)}`, color: '#2563EB', bg: '#2563EB15' };
  };

  // Evaluar estado para Caridad
  const getCharityStatus = (actual: number, target: number) => {
    if (actual >= target - 1) {
      return { label: '✅ Target cumplido', color: '#059669', bg: '#05966915' };
    }
    const diff = (healthData.totalExpense * (target - actual)) / 100;
    return { label: `⚠️ Te faltan ${formatCurrency(diff)}`, color: '#059669', bg: '#05966915' };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Surface style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          {/* Cabecera */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.h3, { fontWeight: '700', color: theme.colors.onSurface }]}>
                📊 Análisis de Salud Financiera
              </Text>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginTop: 2 }]}>
                Metodología activa: {selectedMethodology.name}
              </Text>
            </View>
            <IconButton icon="close" size={22} onPress={onDismiss} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* SELECTOR DE METODOLOGÍA SUPERIOR */}
            <View style={{ marginBottom: 18 }}>
              <Text style={[styles.sectionTitle, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                ⚙️ SELECCIONAR METODOLOGÍA FINANCIERA
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {PRESET_METHODOLOGIES.map((m) => (
                  <Chip
                    key={m.code}
                    selected={selectedCode === m.code}
                    onPress={() => setSelectedCode(m.code)}
                    showSelectedOverlay
                    style={{
                      marginRight: 8,
                      backgroundColor: selectedCode === m.code ? theme.colors.primaryContainer : theme.colors.surfaceVariant + '60',
                      borderColor: selectedCode === m.code ? theme.colors.primary : theme.colors.outline + '30',
                      borderWidth: 1,
                    }}
                    textStyle={{
                      color: selectedCode === m.code ? theme.colors.primary : theme.colors.onSurfaceVariant,
                      fontWeight: selectedCode === m.code ? '700' : '500',
                      fontSize: 12,
                    }}
                  >
                    {m.name}
                  </Chip>
                ))}
              </ScrollView>
            </View>

            {/* TARJETA 1: Necesidades */}
            {selectedMethodology.targets.needs !== undefined && (() => {
              const target = selectedMethodology.targets.needs!;
              const actual = healthData.actualPercentages.needs;
              const status = getNeedsStatus(actual, target);

              return (
                <Surface style={[styles.pillarCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '20' }]}>
                  <View style={styles.pillarHeader}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: theme.colors.onSurface }}>
                      Necesidades Básicas
                    </Text>
                    <View style={[styles.badge, { backgroundColor: status.bg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: status.color }}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.valueRow}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.onSurface }}>
                      Real: {actual}%
                    </Text>
                  </View>

                  <TargetProgressBar actual={actual} target={target} color={status.color} />

                  <Text style={{ fontSize: 11, color: theme.customColors.textSecondary, marginTop: 4 }}>
                    Gasto real fijos: {formatCurrency(healthData.actualAmounts.needs)}
                  </Text>
                </Surface>
              );
            })()}

            {/* TARJETA 2: Deseos & Ocio */}
            {selectedMethodology.targets.wants !== undefined && (() => {
              const target = selectedMethodology.targets.wants!;
              const actual = healthData.actualPercentages.wants;
              const status = getWantsStatus(actual, target);

              return (
                <Surface style={[styles.pillarCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '20' }]}>
                  <View style={styles.pillarHeader}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: theme.colors.onSurface }}>
                      Deseos & Estilo de Vida
                    </Text>
                    <View style={[styles.badge, { backgroundColor: status.bg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: status.color }}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.valueRow}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.onSurface }}>
                      Real: {actual}%
                    </Text>
                  </View>

                  <TargetProgressBar actual={actual} target={target} color={status.color} />

                  <Text style={{ fontSize: 11, color: theme.customColors.textSecondary, marginTop: 4 }}>
                    Gasto real ocio: {formatCurrency(healthData.actualAmounts.wants)}
                  </Text>
                </Surface>
              );
            })()}

            {/* TARJETA 3: Ahorros e Inversión */}
            {selectedMethodology.targets.savings !== undefined && (() => {
              const target = selectedMethodology.targets.savings!;
              const actual = healthData.actualPercentages.savings;
              const status = getSavingsStatus(actual, target);

              return (
                <Surface style={[styles.pillarCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '20' }]}>
                  <View style={styles.pillarHeader}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: theme.colors.onSurface }}>
                      Ahorros & Inversión
                    </Text>
                    <View style={[styles.badge, { backgroundColor: status.bg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: status.color }}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.valueRow}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.onSurface }}>
                      Real: {actual}%
                    </Text>
                  </View>

                  <TargetProgressBar actual={actual} target={target} color={status.color} />

                  <Text style={{ fontSize: 11, color: theme.customColors.textSecondary, marginTop: 4 }}>
                    Total ahorrado/invertido: {formatCurrency(healthData.actualAmounts.savings)}
                  </Text>
                </Surface>
              );
            })()}

            {/* TARJETA 4: Caridad (para 70/20/10) */}
            {selectedMethodology.targets.charity !== undefined && (() => {
              const target = selectedMethodology.targets.charity!;
              const actual = healthData.actualPercentages.charity;
              const status = getCharityStatus(actual, target);

              return (
                <Surface style={[styles.pillarCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '20' }]}>
                  <View style={styles.pillarHeader}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: theme.colors.onSurface }}>
                      Caridad & Donaciones
                    </Text>
                    <View style={[styles.badge, { backgroundColor: status.bg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: status.color }}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.valueRow}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.onSurface }}>
                      Real: {actual}%
                    </Text>
                  </View>

                  <TargetProgressBar actual={actual} target={target} color={status.color} />

                  <Text style={{ fontSize: 11, color: theme.customColors.textSecondary, marginTop: 4 }}>
                    Total donado/caridad: {formatCurrency(healthData.actualAmounts.charity)}
                  </Text>
                </Surface>
              );
            })()}

            {/* Recomendaciones Inteligentes */}
            {healthData.recommendations.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.sectionTitle, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                  OBSERVACIONES DEL SISTEMA
                </Text>
                {healthData.recommendations.map((rec, idx) => (
                  <View key={idx} style={[styles.recCard, { backgroundColor: theme.colors.surfaceVariant + '30' }]}>
                    <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={{ flex: 1, fontSize: 12, color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
                      {rec}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6,
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
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
});
