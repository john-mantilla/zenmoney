/**
 * ZenMoney — CashFlowForecastChart
 *
 * Gráfica y panel de métricas de proyección de liquidez multi-horizonte.
 * Soporta alternador de horizontes (30, 60, 90, 180 días), modo de gasto
 * y superposición de escenarios What-If en tiempo real.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, Pressable } from 'react-native';
import { Surface, Text, SegmentedButtons, Button, Chip } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import {
  CashFlowForecast,
  ForecastHorizonDays,
  ForecastSpendingMode,
  DailyLiquidityPoint,
} from '@/src/domain/entities/CashFlowForecast';
import { ScenarioComparison } from '@/src/domain/entities/LoanScenario';
import {
  formatCompactCurrency,
  calculateChartScale,
  ChartScale,
} from '@/src/domain/utils/financialMath';
import { LiquidityAlertBadge } from './LiquidityAlertBadge';

export { formatCompactCurrency, calculateChartScale, ChartScale };

export interface CashFlowForecastChartProps {
  forecast: CashFlowForecast;
  simulatedComparison?: ScenarioComparison | null;
  horizonDays: ForecastHorizonDays;
  onChangeHorizon: (h: ForecastHorizonDays) => void;
  spendingMode: ForecastSpendingMode;
  onChangeSpendingMode: (mode: ForecastSpendingMode) => void;
  onOpenSimulator?: () => void;
  onClearSimulation?: () => void;
}

export const CashFlowForecastChart: React.FC<CashFlowForecastChartProps> = ({
  forecast,
  simulatedComparison,
  horizonDays,
  onChangeHorizon,
  spendingMode,
  onChangeSpendingMode,
  onOpenSimulator,
  onClearSimulation,
}) => {
  const theme = useAppTheme();
  const screenWidth = Dimensions.get('window').width;
  const [selectedPoint, setSelectedPoint] = useState<DailyLiquidityPoint | null>(null);

  // Muestreo adaptativo de puntos para la gráfica para evitar saturar la pantalla
  const step = horizonDays === 30 ? 3 : horizonDays === 60 ? 5 : horizonDays === 90 ? 7 : 14;
  const sampledBasePoints: DailyLiquidityPoint[] = [];
  for (let i = 0; i < forecast.points.length; i += step) {
    sampledBasePoints.push(forecast.points[i]);
  }
  // Asegurar que el último punto siempre esté incluido
  const lastBase = forecast.points[forecast.points.length - 1];
  if (lastBase && sampledBasePoints[sampledBasePoints.length - 1]?.dayIndex !== lastBase.dayIndex) {
    sampledBasePoints.push(lastBase);
  }

  // Datos para react-native-gifted-charts
  const chartData1 = sampledBasePoints.map((pt) => {
    const parts = pt.date.split('-');
    const label = `${parts[2]}/${parts[1]}`;
    return {
      value: pt.closingBalance,
      label,
      date: pt.date,
      dataPointText: undefined,
      onPress: () => setSelectedPoint(pt),
    };
  });

  // Datos de la curva de simulación (si existe escenario activo)
  let chartData2: any[] = [];
  if (simulatedComparison) {
    const simPoints = simulatedComparison.simulatedPoints;
    const sampledSimPoints: DailyLiquidityPoint[] = [];
    for (let i = 0; i < simPoints.length; i += step) {
      sampledSimPoints.push(simPoints[i]);
    }
    const lastSim = simPoints[simPoints.length - 1];
    if (lastSim && sampledSimPoints[sampledSimPoints.length - 1]?.dayIndex !== lastSim.dayIndex) {
      sampledSimPoints.push(lastSim);
    }
    chartData2 = sampledSimPoints.map((pt) => ({
      value: pt.closingBalance,
      onPress: () => setSelectedPoint(pt),
    }));
  }

  const allValues = [
    ...chartData1.map((d) => d.value),
    ...chartData2.map((d) => d.value),
  ];
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const scale = calculateChartScale(minVal, maxVal);

  const maxContainerWidth = Math.min(screenWidth, 900);
  const chartWidth = Math.max(maxContainerWidth - 80, 280);
  const numSegments = Math.max(1, chartData1.length - 1);
  const dynamicSpacing = Math.max(28, (chartWidth - 80) / numSegments);

  const netBaseChange = forecast.endingBalance - forecast.initialLiquidity;
  const isNetPositive = netBaseChange >= 0;

  return (
    <View style={styles.wrapper}>
      {/* 1. Selector de Horizonte Temporal */}
      <View style={styles.horizonRow}>
        <SegmentedButtons
          value={String(horizonDays)}
          onValueChange={(val) => onChangeHorizon(Number(val) as ForecastHorizonDays)}
          buttons={[
            { value: '30', label: '30 Días' },
            { value: '60', label: '60 Días' },
            { value: '90', label: '90 Días' },
            { value: '180', label: '180 Días' },
          ]}
          density="small"
          style={styles.segmentedButtons}
        />
      </View>

      {/* 2. Selector de Modo de Gasto y Botón Simulador */}
      <View style={styles.filterRow}>
        <SegmentedButtons
          value={spendingMode}
          onValueChange={(val) => onChangeSpendingMode(val as ForecastSpendingMode)}
          buttons={[
            { value: 'commitments_only', label: 'Solo compromisos' },
            { value: 'total_projected', label: 'Gasto total' },
          ]}
          density="small"
          style={{ flex: 1 }}
        />

        {onOpenSimulator && (
          <Button
            mode={simulatedComparison ? 'contained-tonal' : 'outlined'}
            icon="calculator-variant-outline"
            onPress={onOpenSimulator}
            compact
            style={styles.simulatorButton}
          >
            {simulatedComparison ? 'Escenario Activo' : 'Simular'}
          </Button>
        )}
      </View>

      {/* Chip de Escenario Activo con opción para limpiar */}
      {simulatedComparison && (
        <View style={styles.activeScenarioBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <MaterialCommunityIcons name="swap-horizontal-bold" size={18} color="#8A05BE" />
            <Text style={[theme.typography.caption, { color: '#8A05BE', fontWeight: '700' }]}>
              Simulando: {simulatedComparison.scenario.name} (Cuota: ${simulatedComparison.monthlyInstallment.toLocaleString('es-CO')}/mes)
            </Text>
          </View>
          {onClearSimulation && (
            <Chip
              icon="close"
              compact
              onPress={onClearSimulation}
              textStyle={{ fontSize: 10 }}
              style={{ height: 26 }}
            >
              Quitar
            </Chip>
          )}
        </View>
      )}

      {/* 3. Badge de Alerta de Liquidez y Quiebre */}
      <LiquidityAlertBadge
        isAtRisk={simulatedComparison ? (simulatedComparison.causesNewDeficit || forecast.isAtRisk) : forecast.isAtRisk}
        daysToDeficit={simulatedComparison?.daysToDeficit ?? forecast.daysToDeficit}
        deficitDate={simulatedComparison?.deficitDate ?? forecast.deficitDate}
        minimumBalance={simulatedComparison?.minimumSimulatedBalance ?? forecast.minimumBalance}
        minimumBalanceDate={forecast.minimumBalanceDate}
        horizonDays={horizonDays}
      />

      {/* 4. Métricas Resumen */}
      <View style={styles.metricsGrid}>
        <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
            Saldo Actual
          </Text>
          <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface, marginTop: 2 }]}>
            ${forecast.initialLiquidity.toLocaleString('es-CO')}
          </Text>
        </Surface>

        <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
            Saldo en {horizonDays}d
          </Text>
          <Text
            style={[
              theme.typography.body,
              {
                fontWeight: '700',
                color: (simulatedComparison?.endingSimulatedBalance ?? forecast.endingBalance) < 0 ? '#DC2626' : theme.colors.primary,
                marginTop: 2,
              },
            ]}
          >
            ${(simulatedComparison?.endingSimulatedBalance ?? forecast.endingBalance).toLocaleString('es-CO')}
          </Text>
        </Surface>

        <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
            Saldo Mínimo
          </Text>
          <Text
            style={[
              theme.typography.body,
              {
                fontWeight: '700',
                color: (simulatedComparison?.minimumSimulatedBalance ?? forecast.minimumBalance) < 0 ? '#DC2626' : '#D97706',
                marginTop: 2,
              },
            ]}
          >
            ${(simulatedComparison?.minimumSimulatedBalance ?? forecast.minimumBalance).toLocaleString('es-CO')}
          </Text>
        </Surface>

        <Surface style={[styles.metricCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
            Flujo Neto
          </Text>
          <Text
            style={[
              theme.typography.body,
              {
                fontWeight: '700',
                color: isNetPositive ? '#059669' : '#DC2626',
                marginTop: 2,
              },
            ]}
          >
            {isNetPositive ? '+' : ''}${netBaseChange.toLocaleString('es-CO')}
          </Text>
        </Surface>
      </View>

      {/* 5. Gráfica Interactiva */}
      <Surface style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.chartHeader}>
          <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
            Curva de Liquidez Proyectada
          </Text>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={{ fontSize: 10, color: theme.customColors.textSecondary }}>Base</Text>
            </View>
            {simulatedComparison && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#8A05BE' }]} />
                <Text style={{ fontSize: 10, color: '#8A05BE', fontWeight: '600' }}>Escenario</Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={{
            marginLeft: -10,
            marginTop: 10,
            marginBottom: scale.noOfSectionsBelowXAxis > 0 ? scale.noOfSectionsBelowXAxis * scale.stepHeight + 24 : 12,
          }}
        >
          <LineChart
            data={chartData1}
            data2={chartData2.length > 0 ? chartData2 : undefined}
            height={scale.height}
            stepHeight={scale.stepHeight}
            maxValue={scale.maxValue}
            stepValue={scale.stepValue}
            noOfSections={scale.noOfSections}
            noOfSectionsBelowXAxis={scale.noOfSectionsBelowXAxis}
            xAxisLabelsAtBottom
            mostNegativeValue={scale.noOfSectionsBelowXAxis > 0 ? -(scale.stepValue * scale.noOfSectionsBelowXAxis) : 0}
            width={chartWidth}
            spacing={dynamicSpacing}
            initialSpacing={24}
            endSpacing={24}
            thickness={3}
            thickness2={3}
            color1={theme.colors.primary}
            color2="#8A05BE"
            strokeDashArray2={[5, 5]}
            dataPointsColor1={theme.colors.primary}
            dataPointsColor2="#8A05BE"
            dataPointsRadius={4}
            curved
            isAnimated={false}
            rulesColor="rgba(0,0,0,0.06)"
            rulesType="solid"
            yAxisLabelWidth={58}
            formatYLabel={formatCompactCurrency}
            yAxisTextStyle={{
              fontSize: 10,
              color: theme.customColors.textSecondary,
            }}
            xAxisLabelTextStyle={{
              fontSize: 10,
              color: theme.customColors.textSecondary,
            }}
            startFillColor1={theme.colors.primary}
            endFillColor1={theme.colors.primary}
            startOpacity1={0.12}
            endOpacity1={0.01}
          />
        </View>

        {/* Detalle interactivo al tocar un punto */}
        {selectedPoint && (
          <View style={styles.pointDetailBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.primary }]}>
                Día {selectedPoint.dayIndex} ({selectedPoint.date})
              </Text>
              <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
                Cierre: ${selectedPoint.closingBalance.toLocaleString('es-CO')}
              </Text>
            </View>
            {selectedPoint.events.length > 0 ? (
              <View style={{ marginTop: 6, gap: 4 }}>
                {selectedPoint.events.map((ev, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, color: theme.customColors.textSecondary }}>
                      • {ev.description}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: ev.type === 'income' ? '#059669' : '#DC2626',
                      }}
                    >
                      {ev.type === 'income' ? '+' : '-'}${ev.amount.toLocaleString('es-CO')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 11, color: theme.customColors.textSecondary, marginTop: 4 }}>
                Sin movimientos programados en esta fecha.
              </Text>
            )}
          </View>
        )}
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  horizonRow: {
    marginBottom: 8,
  },
  segmentedButtons: {
    borderRadius: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  simulatorButton: {
    borderRadius: 10,
  },
  activeScenarioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 170,
    borderRadius: 14,
    padding: 12,
  },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pointDetailBox: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
});
