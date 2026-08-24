import React, { useState } from 'react';
import { View, Dimensions, Platform } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import { useAppTheme } from '@/src/presentation/theme';
import { TrendDataPoint } from '@/src/domain/usecases/TrendAnalysisUseCase';

interface Props {
  data: TrendDataPoint[];
}

export const TrendChart: React.FC<Props> = ({ data }) => {
  const theme = useAppTheme();
  const screenWidth = Dimensions.get('window').width;

  // Transform data for gifted-charts
  const incomeData = data.map((d) => ({
    value: Number(d.income) || 0,
    label: d.label,
    date: d.fullDate,
    income: Number(d.income) || 0,
    expense: Number(d.expense) || 0,
    budget: Number(d.budget) || 0,
  }));
  const expenseData = data.map((d) => ({
    value: Number(d.expense) || 0,
  }));
  const budgetData = data.map((d) => ({
    value: Number(d.budget) || 0,
  }));

  const maxVal = Math.max(
    ...data.map(d => Math.max(Number(d.expense) || 0, Number(d.income) || 0, Number(d.budget) || 0))
  );
  
  // Si no hay datos, maxValue sería -Infinity o 0 y rompe la gráfica
  // Multiplicamos por 1.15 para dar un 15% de "headroom" (espacio arriba) 
  // y evitar que las curvas bezier se salgan del lienzo superior al rebotar.
  const safeMaxVal = (!isFinite(maxVal) || maxVal <= 0) ? 100 : maxVal * 1.15;

  // Cálculo dinámico para ajustar perfectamente a la pantalla sin cortar el último mes
  const chartWidth = screenWidth - 70;
  const numSegments = Math.max(1, data.length - 1);
  const startPadding = 15;
  const endPadding = 30; // Extra espacio a la derecha para que el label no se corte
  const dynamicSpacing = (chartWidth - startPadding - endPadding) / numSegments;

  return (
    <Surface elevation={1} style={{ marginHorizontal: 16, borderRadius: 16, padding: 16, paddingBottom: 0, backgroundColor: theme.colors.surface }}>
      <Text style={[theme.typography.h3, { marginBottom: 16, color: theme.colors.onSurface }]}>
        Tendencia Histórica
      </Text>
      
      <View style={{ marginLeft: -16 }}>
        <LineChart
          data={incomeData}
          data2={expenseData}
          data3={budgetData}
          height={220}
          width={chartWidth}
          showVerticalLines
          verticalLinesColor="rgba(0,0,0,0.05)"
          rulesColor="rgba(0,0,0,0.05)"
          rulesType="solid"
          spacing={dynamicSpacing}
          initialSpacing={startPadding}
          endSpacing={endPadding}
          thickness={3}
          thickness2={3}
          thickness3={2}
          color1={theme.customColors.income}
          color2={theme.customColors.expense}
          color3="#2196F3"
          strokeDashArray3={[6, 6]}
          dataPointsColor1={theme.customColors.income}
          dataPointsColor2={theme.customColors.expense}
          dataPointsColor3="#2196F3"
          hideDataPoints1={false}
          hideDataPoints2={false}
          hideDataPoints3={false}
          dataPointsRadius={3}
          curved
          isAnimated
          animationDuration={800}
          animateOnDataChange
          
          // Gradientes para Ingresos y Gastos (Presupuesto sin relleno de área)
          startFillColor1={theme.customColors.income}
          endFillColor1={theme.customColors.income}
          startOpacity1={0.15}
          endOpacity1={0.0}
          
          startFillColor2={theme.customColors.expense}
          endFillColor2={theme.customColors.expense}
          startOpacity2={0.15}
          endOpacity2={0.0}

          startFillColor3="transparent"
          endFillColor3="transparent"
          startOpacity3={0.0}
          endOpacity3={0.0}
          areaChart
          
          // Ejes
          yAxisTextStyle={{ color: theme.customColors.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: theme.customColors.textSecondary, fontSize: 10 }}
          yAxisLabelTexts={Array.from({ length: 6 }, (_, i) => {
            const v = (safeMaxVal / 5) * i;
            if (v > 1000000) return `${(v / 1000000).toFixed(1)}M`;
            if (v > 1000) return `${(v / 1000).toFixed(0)}k`;
            return v.toString();
          })}
          noOfSections={5}
          maxValue={safeMaxVal}
          
          // Tooltips interactivos
          pointerConfig={{
            pointerStripHeight: 160,
            pointerStripColor: 'lightgray',
            pointerStripWidth: 2,
            pointerColor: theme.colors.onSurface,
            radius: 6,
            pointerLabelWidth: 120,
            pointerLabelHeight: 90,
            activatePointersOnLongPress: false,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any) => {
              if (!items || !items[0]) return null;
              const pt = items[0];
              
              // Evitar que el tooltip se corte en los bordes de la pantalla
              const index = data.findIndex(d => d.fullDate === pt.date);
              const isNearRight = index >= data.length - 2;
              const isNearLeft = index <= 1;
              let leftOffset = -40; // Centrado por defecto
              if (isNearRight) leftOffset = -90; // Empujar a la izquierda
              if (isNearLeft) leftOffset = 10; // Empujar a la derecha

              return (
                <View style={{ width: 120, left: leftOffset }}>
                  <Surface style={{ padding: 8, borderRadius: 8, backgroundColor: theme.colors.inverseSurface }} elevation={4}>
                    <Text style={{ color: theme.colors.inverseOnSurface, fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>{pt.date}</Text>
                    <Text style={{ color: theme.customColors.income, fontSize: 11 }}>Ingreso: ${Math.round(pt.income || 0).toLocaleString('es-CO')}</Text>
                    <Text style={{ color: theme.customColors.expense, fontSize: 11 }}>Gasto: ${Math.round(pt.expense || 0).toLocaleString('es-CO')}</Text>
                    <Text style={{ color: "#2196F3", fontSize: 11 }}>Pto: ${Math.round(pt.budget || 0).toLocaleString('es-CO')}</Text>
                  </Surface>
                </View>
              );
            },
          }}
        />
      </View>

      {/* Leyenda */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, marginBottom: 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.customColors.income, marginRight: 4 }} />
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Ingresos</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.customColors.expense, marginRight: 4 }} />
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>Gastos</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#2196F3", marginRight: 4 }} />
          <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>Presupuesto</Text>
        </View>
      </View>
    </Surface>
  );
};
