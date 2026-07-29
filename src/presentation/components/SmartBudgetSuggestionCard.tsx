/**
 * ZenMoney — Componente SmartBudgetSuggestionCard
 *
 * Muestra la sugerencia de presupuesto realista basada en el promedio de consumo histórico (3 meses),
 * ofreciendo un botón de 1-tap para aplicar la meta intermedia sin frustración.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Button } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { RealisticBudgetSuggestion } from '@/src/domain/usecases/SuggestRealisticBudget';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface SmartBudgetSuggestionCardProps {
  suggestion: RealisticBudgetSuggestion;
  onApplySuggestion: (amount: number) => void;
  onDismiss?: () => void;
}

export const SmartBudgetSuggestionCard: React.FC<SmartBudgetSuggestionCardProps> = ({
  suggestion,
  onApplySuggestion,
  onDismiss,
}) => {
  const theme = useAppTheme();

  const formatCurrency = (val: number) => {
    return `$${Math.abs(Math.round(val)).toLocaleString('es-CO')}`;
  };

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.primaryContainer + '30', borderColor: theme.colors.primary + '50' }]}>
      <View style={styles.rowHeader}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '20' }]}>
          <MaterialCommunityIcons name="robot-outline" size={20} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.primary }]}>
          Sugerencia Realista ZenMoney
        </Text>
      </View>

      <Text style={[styles.reason, { color: theme.colors.onSurfaceVariant }]}>
        {suggestion.reason}
      </Text>

      <View style={styles.actionRow}>
        <Button
          mode="contained"
          icon="lightning-bolt"
          buttonColor={theme.colors.primary}
          textColor="#FFFFFF"
          compact
          onPress={() => onApplySuggestion(suggestion.suggestedAmount)}
          style={styles.applyBtn}
          labelStyle={{ fontWeight: '700', fontSize: 12 }}
        >
          Aplicar {formatCurrency(suggestion.suggestedAmount)}
        </Button>
        {onDismiss && (
          <Button mode="text" compact onPress={onDismiss} textColor={theme.customColors.textSecondary}>
            Omitir
          </Button>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  reason: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  applyBtn: {
    borderRadius: 10,
  },
});
