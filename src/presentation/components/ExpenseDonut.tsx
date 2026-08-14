import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Surface, Text, List } from 'react-native-paper';
import { PieChart } from 'react-native-gifted-charts';
import { useAppTheme } from '@/src/presentation/theme';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface Props {
  expenses: Transaction[];
  categories: Category[];
  monthLabel: string;
}

export const ExpenseDonut: React.FC<Props> = ({ expenses, categories, monthLabel }) => {
  const theme = useAppTheme();

  const { chartData, total, topCategories } = useMemo(() => {
    let sum = 0;
    const catTotals: Record<string, { id: string; name: string; amount: number; color: string; icon: string }> = {};

    // Filtrar estrictamente solo transacciones de tipo 'expense' y estado 'confirmed'
    const onlyExpenses = expenses.filter(tx => tx.status === 'confirmed' && tx.type === 'expense');

    for (const tx of onlyExpenses) {
      sum += tx.amount;
      
      const catId = tx.categoryId;
      let catName = 'Sin clasificar';
      let catColor = theme.customColors.expense || '#EF4444';
      let catIcon = 'tag-outline';
      let groupKey = 'uncategorized';

      if (catId) {
        const cat = categories.find(c => c.id === catId);
        if (cat) {
          if (cat.parentCategoryId) {
            const parentCat = categories.find(c => c.id === cat.parentCategoryId);
            if (parentCat) {
              groupKey = parentCat.id;
              catName = parentCat.name;
              catColor = parentCat.color || catColor;
              catIcon = parentCat.icon || catIcon;
            } else {
              groupKey = cat.id;
              catName = cat.name;
              catColor = cat.color || catColor;
              catIcon = cat.icon || catIcon;
            }
          } else {
            groupKey = cat.id;
            catName = cat.name;
            catColor = cat.color || catColor;
            catIcon = cat.icon || catIcon;
          }
        }
      }

      if (!catTotals[groupKey]) {
        catTotals[groupKey] = { id: groupKey, name: catName, amount: 0, color: catColor, icon: catIcon };
      }
      catTotals[groupKey].amount += tx.amount;
    }

    const sortedCats = Object.values(catTotals).sort((a, b) => b.amount - a.amount);
    const top = sortedCats.slice(0, 5); // Top 5 para la leyenda
    
    const data = sortedCats.map(c => ({
      value: c.amount,
      color: c.color,
      text: sum > 0 ? `${Math.round((c.amount / sum) * 100)}%` : '0%',
    }));

    // Si no hay gastos, mostrar un disco vacío gris
    if (data.length === 0) {
      data.push({ value: 1, color: theme.colors.surfaceVariant, text: '' });
    }

    return { chartData: data, total: sum, topCategories: top };
  }, [expenses, categories, theme]);

  return (
    <Surface elevation={1} style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, backgroundColor: theme.colors.surface }}>
      <Text style={[theme.typography.h3, { marginBottom: 16, color: theme.colors.onSurface }]}>
        Gastos de {monthLabel}
      </Text>
      
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PieChart
            data={chartData}
            donut
            isAnimated
            animationDuration={600}
            showGradient
            sectionAutoFocus
            radius={80}
            innerRadius={60}
            innerCircleColor={theme.colors.surface}
            centerLabelComponent={() => {
              return (
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: theme.customColors.textSecondary, marginBottom: 2 }}>TOTAL</Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.onSurface }}>
                    ${Math.round(total / 1000).toLocaleString('es-CO')}k
                  </Text>
                </View>
              );
            }}
          />
        </View>

        <View style={{ flex: 1 }}>
          {topCategories.length === 0 ? (
            <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary, textAlign: 'center' }]}>
              No hay gastos registrados este mes.
            </Text>
          ) : (
            topCategories.map((cat, index) => (
              <View key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: cat.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                  <MaterialCommunityIcons name={cat.icon as any} size={16} color={cat.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { fontWeight: 'bold', color: theme.colors.onSurface }]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                  <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary }]}>
                    ${Math.round(cat.amount).toLocaleString('es-CO')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </Surface>
  );
};
