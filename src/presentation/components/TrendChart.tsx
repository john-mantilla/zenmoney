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
  const expenseData = data.map((d, i) => ({
    value: Number(d.expense) || 0,
    label: d.label,
    date: d.fullDate,
    income: Number(d.income) || 0,
    budget: Number(d.budget) || 0,
    expense: Number(d.expense) || 0,
  }));
  const incomeData = data.map((d, i) => ({
    value: Number(d.income) || 0,
  }));
  const budgetData = data.map((d, i) => ({
    value: Number(d.budget) || 0,
  }));

  const maxVal = Math.max(
    ...data.map(d => Math.max(Number(d.expense) || 0, Number(d.income) || 0, Number(d.budget) || 0))
  );
  
  // Si no hay datos, maxValue sería -Infinity o 0 y rompe la gráfica
  const safeMaxVal = (!isFinite(maxVal) || maxVal <= 0) ? 100 : maxVal;

  return (
    <Surface elevation={1} style={{ marginHorizontal: 16, borderRadius: 16, padding: 16, paddingBottom: 0, backgroundColor: theme.colors.surface }}>
      <Text style={[theme.typography.h3, { marginBottom: 16, color: theme.colors.onSurface }]}>
        Tendencia Histórica
      </Text>
      
      <View style={{ marginLeft: -16 }}>
        <LineChart
          data={expenseData}
          data2={incomeData}
          data3={budgetData}
          height={220}
          width={screenWidth - 90}
          showVerticalLines
          verticalLinesColor="rgba(0,0,0,0.05)"
          rulesColor="rgba(0,0,0,0.05)"
          rulesType="solid"
          spacing={(screenWidth - 90) / 11}
          initialSpacing={10}
          endSpacing={10}
          thickness={3}
          thickness2={3}
          thickness3={2}
          color1={theme.customColors.expense}
          color2={theme.customColors.income}
          color3="#2196F3"
          dataPointsColor1={theme.customColors.expense}
          dataPointsColor2={theme.customColors.income}
          dataPointsColor3="#2196F3"
          hideDataPoints1={false}
          hideDataPoints2={false}
          hideDataPoints3={false}
          dataPointsRadius={2}
          curved
          isAnimated={false}
          
          // Gradientes para Income y Expense
          startFillColor1={theme.customColors.expense}
          endFillColor1={theme.customColors.expense}
          startOpacity1={0.2}
          endOpacity1={0.0}
          startFillColor2={theme.customColors.income}
          endFillColor2={theme.customColors.income}
          startOpacity2={0.2}
          endOpacity2={0.0}
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
              const isNearRight = index >= 9;
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
