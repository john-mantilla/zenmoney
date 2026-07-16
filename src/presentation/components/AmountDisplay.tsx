/**
 * ZenMoney — Componente AmountDisplay
 *
 * Muestra valores financieros con formato localizado de pesos colombianos ($45.000)
 * utilizando la tipografía mono-espaciada JetBrains Mono.
 */

import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { useAppTheme } from '../theme';

interface AmountDisplayProps {
  amount: number;
  currency?: string;
  type?: 'income' | 'expense' | 'transfer' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  style?: TextStyle;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  amount,
  currency = 'COP',
  type = 'neutral',
  size = 'md',
  style,
}) => {
  const theme = useAppTheme();
  const isNegative = amount < 0;

  // Determinar color basado en el tipo
  let color = theme.colors.onSurface;
  if (type === 'income') {
    color = theme.customColors.income;
  } else if (type === 'expense') {
    color = theme.customColors.expense;
  } else if (type === 'transfer') {
    color = theme.customColors.transfer;
  } else if (type === 'neutral' && isNegative) {
    // Saldo de cuenta en rojo (sobregiro): debe alertar, nunca disfrazarse de positivo
    color = theme.customColors.expense;
  }

  // Determinar tamaño de fuente
  let fontStyle = theme.typography.amount;
  if (size === 'sm') {
    fontStyle = theme.typography.amountSmall;
  } else if (size === 'lg') {
    fontStyle = theme.typography.amountLarge;
  }

  // Formatear número (Estilo colombiano: miles con punto)
  const formattedAmount = Math.abs(amount).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Prefijo (+ para ingresos, - para gastos, - para saldos de cuenta en negativo)
  let prefix = '';
  if (type === 'income') {
    prefix = '+ ';
  } else if (type === 'expense') {
    prefix = '- ';
  } else if (type === 'neutral' && isNegative) {
    prefix = '- ';
  }

  // Mostrar el símbolo de la moneda
  const symbol = currency === 'COP' ? '$' : `${currency} `;

  return (
    <Text style={[styles.text, fontStyle, { color }, style]}>
      {prefix}
      {symbol}
      {formattedAmount}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    // Asegurar alineación y que use la fuente monoespaciada
    textAlignVertical: 'center',
  },
});
