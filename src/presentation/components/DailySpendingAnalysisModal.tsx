/**
 * ZenMoney — Modal de Análisis de Comportamiento Diario de Gastos
 *
 * Muestra el comportamiento diario de gastos (1..31), gráfico interactivo con
 * resaltado de fines de semana, desglose por día/categoría y patrones semanales (Lun-Dom).
 * 100% compatible con React Native Mobile (iOS/Android) y Web.
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Pressable, Platform } from 'react-native';
import { Modal, Portal, Text, IconButton, Surface, Chip, Divider, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { DailySpendingAnalysis, DailySpendingPoint } from '@/src/domain/usecases/DailySpendingAnalysis';
import { AmountDisplay } from './AmountDisplay';
import { hapticLight } from '@/src/infrastructure/utils/haptics';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  transactions: Transaction[];
  categories: Category[];
  year: number;
  month: number;
}

export const DailySpendingAnalysisModal: React.FC<Props> = ({
  visible,
  onDismiss,
  transactions,
  categories,
  year,
  month,
}) => {
  const theme = useAppTheme();
  const screenWidth = Dimensions.get('window').width;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedDayPoint, setSelectedDayPoint] = useState<DailySpendingPoint | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');

  // Categorías principales (padre) para el selector de filtros
  const parentCategories = useMemo(() => {
    return categories.filter(c => !c.parentCategoryId);
  }, [categories]);

  // Ejecutar el caso de uso
  const analysis = useMemo(() => {
    return DailySpendingAnalysis.execute(transactions, categories, year, month, selectedCategoryId);
  }, [transactions, categories, year, month, selectedCategoryId]);

  // Calcular el valor máximo diario para escalar las alturas de las barras
  const maxDailyVal = useMemo(() => {
    const max = Math.max(...analysis.dailyPoints.map(p => p.total), 0);
    return max > 0 ? max : 1;
  }, [analysis.dailyPoints]);

  const maxWeekdayVal = useMemo(() => {
    const max = Math.max(...analysis.weekdayPoints.map(p => p.total), 0);
    return max > 0 ? max : 1;
  }, [analysis.weekdayPoints]);

  // Formato del mes
  const monthName = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }, [year, month]);

  const handleSelectDay = (point: DailySpendingPoint) => {
    hapticLight();
    if (selectedDayPoint?.day === point.day) {
      setSelectedDayPoint(null);
    } else {
      setSelectedDayPoint(point);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline + '40',
          },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700', textTransform: 'uppercase' }]}>
              Comportamiento de Gastos
            </Text>
            <Text style={[theme.typography.h2, { color: theme.colors.onSurface, textTransform: 'capitalize', fontWeight: 'bold' }]}>
              {monthName}
            </Text>
          </View>
          <IconButton icon="close" size={24} iconColor={theme.colors.onSurface} onPress={onDismiss} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Selector de Categorías (Chips horizontales) */}
          <View style={{ marginBottom: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip
                selected={selectedCategoryId === null}
                onPress={() => {
                  hapticLight();
                  setSelectedCategoryId(null);
                }}
                showSelectedOverlay
                style={{
                  backgroundColor: selectedCategoryId === null ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                }}
                textStyle={{ fontSize: 12, fontWeight: selectedCategoryId === null ? '700' : '500' }}
              >
                Todas las categorías
              </Chip>
              {parentCategories.map(cat => (
                <Chip
                  key={cat.id}
                  selected={selectedCategoryId === cat.id}
                  onPress={() => {
                    hapticLight();
                    setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id);
                  }}
                  showSelectedOverlay
                  icon={cat.icon || 'tag'}
                  style={{
                    backgroundColor: selectedCategoryId === cat.id ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                  }}
                  textStyle={{ fontSize: 12, fontWeight: selectedCategoryId === cat.id ? '700' : '500' }}
                >
                  {cat.name}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Tarjetas resumen de métricas clave */}
          <View style={styles.metricsRow}>
            <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Total Gastado</Text>
              <AmountDisplay amount={analysis.totalSpending} size="sm" type="expense" style={{ marginTop: 4 }} />
            </Surface>

            <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons name="weather-sunset" size={14} color="#F59E0B" />
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Fines de Semana</Text>
              </View>
              <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface, marginTop: 4 }]}>
                {analysis.weekendPercentage}% <Text style={{ fontSize: 11, fontWeight: '400', color: theme.customColors.textSecondary }}>(${Math.round(analysis.weekendSpending).toLocaleString('es-CO')})</Text>
              </Text>
            </Surface>
          </View>

          {/* Banner de Insight Inteligente ZenMoney */}
          {analysis.totalSpending > 0 && (
            <Surface style={[styles.insightCard, { backgroundColor: theme.colors.primaryContainer + '30', borderColor: theme.colors.primary + '50' }]} elevation={0}>
              <View style={[styles.insightIconCircle, { backgroundColor: theme.colors.primary + '20' }]}>
                <MaterialCommunityIcons name="robot-happy-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.primary, marginBottom: 2 }]}>
                  Patrón Detectado
                </Text>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurfaceVariant, lineHeight: 18 }]}>
                  {analysis.insightMessage}
                </Text>
              </View>
            </Surface>
          )}

          {/* Selector de Pestañas: Días del Mes vs. Días de la Semana */}
          <View style={[styles.tabBar, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Pressable
              onPress={() => setActiveTab('daily')}
              style={[
                styles.tabBtn,
                activeTab === 'daily' && { backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
              ]}
            >
              <Text style={[styles.tabLabel, { color: activeTab === 'daily' ? theme.colors.primary : theme.customColors.textSecondary, fontWeight: activeTab === 'daily' ? '700' : '500' }]}>
                Días del Mes (1-{analysis.dailyPoints.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('weekly')}
              style={[
                styles.tabBtn,
                activeTab === 'weekly' && { backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
              ]}
            >
              <Text style={[styles.tabLabel, { color: activeTab === 'weekly' ? theme.colors.primary : theme.customColors.textSecondary, fontWeight: activeTab === 'weekly' ? '700' : '500' }]}>
                Por Día de Semana (Lun-Dom)
              </Text>
            </Pressable>
          </View>

          {/* VISTA 1: DÍAS DEL MES (Gráfico de barras horizontal interactivo) */}
          {activeTab === 'daily' && (
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                  Toca una barra para ver el desglose
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                  <Text style={[theme.typography.caption, { fontSize: 10, color: theme.customColors.textSecondary }]}>Fin de semana</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.chartScroll}>
                <View style={styles.chartRow}>
                  {analysis.dailyPoints.map(point => {
                    const barHeightPct = point.total > 0 ? Math.max((point.total / maxDailyVal) * 110, 6) : 2;
                    const isSelected = selectedDayPoint?.day === point.day;
                    const isHighest = analysis.maxSpendingDay?.day === point.day && point.total > 0;

                    return (
                      <Pressable
                        key={point.day}
                        onPress={() => handleSelectDay(point)}
                        style={[
                          styles.barColumn,
                          isSelected && { backgroundColor: theme.colors.primaryContainer + '40', borderRadius: 8 },
                        ]}
                      >
                        {/* Contenedor de la barra */}
                        <View style={styles.barTrack}>
                          {isHighest && (
                            <MaterialCommunityIcons
                              name="crown"
                              size={12}
                              color="#F59E0B"
                              style={{ marginBottom: 2 }}
                            />
                          )}
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: barHeightPct,
                                backgroundColor: isSelected
                                  ? theme.colors.primary
                                  : point.isWeekend
                                  ? '#F59E0B'
                                  : point.total > 0
                                  ? theme.colors.primary + 'B0'
                                  : theme.colors.outline + '40',
                              },
                            ]}
                          />
                        </View>

                        {/* Etiqueta del día y día de semana */}
                        <Text
                          style={[
                            styles.barDayText,
                            {
                              color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                              fontWeight: isSelected || point.isWeekend ? '700' : '400',
                            },
                          ]}
                        >
                          {point.day}
                        </Text>
                        <Text
                          style={[
                            styles.barWeekdayText,
                            {
                              color: point.isWeekend ? '#F59E0B' : theme.customColors.textSecondary,
                              fontWeight: point.isWeekend ? '700' : '400',
                            },
                          ]}
                        >
                          {point.dayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Detalle del día seleccionado */}
              {selectedDayPoint && (
                <Surface style={[styles.dayDetailCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons
                        name={selectedDayPoint.isWeekend ? 'weather-sunset' : 'calendar-today'}
                        size={18}
                        color={selectedDayPoint.isWeekend ? '#F59E0B' : theme.colors.primary}
                      />
                      <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                        {selectedDayPoint.dayName}, {selectedDayPoint.day} de {monthName}
                      </Text>
                    </View>
                    <AmountDisplay amount={selectedDayPoint.total} size="sm" type="expense" />
                  </View>

                  <Divider style={{ marginVertical: 6, backgroundColor: theme.colors.outline + '30' }} />

                  {selectedDayPoint.categories.length === 0 ? (
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontStyle: 'italic' }]}>
                      No se registraron gastos en este día.
                    </Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {selectedDayPoint.categories.map(cat => (
                        <View key={cat.categoryId} style={styles.catBreakdownRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: cat.color + '20', justifyContent: 'center', alignItems: 'center' }}>
                              <MaterialCommunityIcons name={cat.icon as any} size={14} color={cat.color} />
                            </View>
                            <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurface, flex: 1 }]} numberOfLines={1}>
                              {cat.name}
                            </Text>
                          </View>
                          <AmountDisplay amount={cat.amount} size="sm" type="expense" />
                        </View>
                      ))}
                    </View>
                  )}
                </Surface>
              )}
            </View>
          )}

          {/* VISTA 2: DÍAS DE LA SEMANA (Lunes a Domingo comparativo) */}
          {activeTab === 'weekly' && (
            <View style={{ marginTop: 12, gap: 10 }}>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 4 }]}>
                Promedio de gasto por día de la semana
              </Text>

              {analysis.weekdayPoints.map(wp => {
                const fillWidthPct = maxWeekdayVal > 0 ? Math.max((wp.total / maxWeekdayVal) * 100, 2) : 2;

                return (
                  <Surface key={wp.dayIndex} style={[styles.weekdayRowCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                    <View style={{ width: 80 }}>
                      <Text style={[theme.typography.body, { fontWeight: '700', color: wp.isWeekend ? '#F59E0B' : theme.colors.onSurface }]}>
                        {wp.name}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 10 }]}>
                        {wp.count} {wp.count === 1 ? 'día' : 'días'}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <View style={[styles.weekdayProgressTrack, { backgroundColor: theme.colors.outline + '25' }]}>
                        <View
                          style={[
                            styles.weekdayProgressFill,
                            {
                              width: `${fillWidthPct}%`,
                              backgroundColor: wp.isWeekend ? '#F59E0B' : theme.colors.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 10, marginTop: 2 }]}>
                        Prom: ${wp.average.toLocaleString('es-CO')}/día
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                      <AmountDisplay amount={wp.total} size="sm" type="expense" />
                    </View>
                  </Surface>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: 16,
    borderRadius: 20,
    maxHeight: '90%',
    padding: 16,
    borderWidth: 1,
    alignSelf: 'center',
    width: Platform.OS === 'web' ? Math.min(Dimensions.get('window').width - 32, 600) : '94%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scrollBody: {
    paddingBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  insightIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 12,
  },
  chartScroll: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: 6,
  },
  barColumn: {
    width: 24,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  barTrack: {
    height: 120,
    width: 14,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: 10,
    borderRadius: 5,
    minHeight: 2,
  },
  barDayText: {
    fontSize: 10,
    marginTop: 4,
  },
  barWeekdayText: {
    fontSize: 8,
  },
  dayDetailCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
  },
  catBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekdayRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
  },
  weekdayProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  weekdayProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
});
