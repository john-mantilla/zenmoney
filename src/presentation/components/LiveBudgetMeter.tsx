/**
 * ZenMoney — Componente LiveBudgetMeter (Micro-feedback & Paradas de Seguridad Progresivas)
 *
 * Muestra visualmente en tiempo real cómo impacta el monto que el usuario está digitando
 * sobre el presupuesto de la categoría seleccionada, sin interrumpir ni bloquear la navegación.
 * Implementa 5 escalas de alerta progresiva (70%, 85%, 95%, 100%+) con cálculo de costo de oportunidad.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { hapticWarning, hapticError } from '@/src/infrastructure/utils/haptics';

interface LiveBudgetMeterProps {
  categoryName: string;
  budgetLimit: number;
  currentSpent: number;
  newExpenseAmount: number;
  currency?: string;
}

export const LiveBudgetMeter: React.FC<LiveBudgetMeterProps> = ({
  categoryName,
  budgetLimit,
  currentSpent,
  newExpenseAmount,
  currency = 'COP',
}) => {
  const theme = useAppTheme();
  const lastAlertRef = useRef<'green' | 'yellow' | 'orange' | 'red_alert' | 'exceeded'>('green');

  const safeLimit = Number(budgetLimit) || 0;
  const safeCurrentSpent = Number(currentSpent) || 0;
  const safeNewAmount = Number(newExpenseAmount) || 0;

  if (safeLimit <= 0) {
    return null;
  }

  const projectedSpent = safeCurrentSpent + Math.max(0, safeNewAmount);
  const currentPct = Math.min(100, (safeCurrentSpent / safeLimit) * 100);
  const newAmountPct = Math.min(100 - currentPct, (Math.max(0, safeNewAmount) / safeLimit) * 100);
  const totalProjectedPct = Math.max(0, (projectedSpent / safeLimit) * 100);
  const remainingAfter = safeLimit - projectedSpent;

  // Días restantes en el mes para costo de oportunidad
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1);
  const dailyAllowance = remainingAfter > 0 ? Math.round(remainingAfter / daysRemaining) : 0;

  const formatCurrency = (val: number) => {
    const clean = isNaN(val) || !isFinite(val) ? 0 : val;
    return `$${Math.abs(Math.round(clean)).toLocaleString('es-CO')}`;
  };

  // Determinar nivel de alerta y mensajes
  let level: 'green' | 'yellow' | 'orange' | 'red_alert' | 'exceeded' = 'green';
  let statusColor = '#059669'; // Verde
  let statusBg = '#05966915';
  let badgeIcon = '🟢';
  let message = `Te quedarán ${formatCurrency(remainingAfter)} de presupuesto`;
  let opportunityAdvice: string | null = null;

  if (totalProjectedPct >= 100) {
    level = 'exceeded';
    statusColor = '#DC2626'; // Rojo crítico
    statusBg = '#DC262615';
    badgeIcon = '🚨';
    message = `Presupuesto superado por ${formatCurrency(Math.abs(remainingAfter))}`;
    opportunityAdvice = `💬 El excedente se compensará con tu margen general del mes.`;
  } else if (totalProjectedPct >= 95) {
    level = 'red_alert';
    statusColor = '#EF4444'; // Rojo alerta
    statusBg = '#EF444415';
    badgeIcon = '🔴';
    message = `95% — Quedarán solo ${formatCurrency(remainingAfter)}`;
    opportunityAdvice = `🚨 Casi al límite. Mañana podría hacer falta para otros gastos de ${categoryName}.`;
  } else if (totalProjectedPct >= 85) {
    level = 'orange';
    statusColor = '#D97706'; // Naranja
    statusBg = '#D9770615';
    badgeIcon = '🟠';
    message = `85% consumido — Atención al límite`;
    opportunityAdvice = `⚠️ Tu disponible baja a ${formatCurrency(dailyAllowance)}/día para los ${daysRemaining} días restantes.`;
  } else if (totalProjectedPct >= 70) {
    level = 'yellow';
    statusColor = '#CA8A04'; // Amarillo ámbar
    statusBg = '#CA8A0415';
    badgeIcon = '🟡';
    message = `70% consumido: Te quedarán ${formatCurrency(remainingAfter)}`;
    opportunityAdvice = `💡 Te quedan ${daysRemaining} días del mes (${formatCurrency(dailyAllowance)}/día).`;
  }

  // Disparar haptics suaves al cruzar umbrales
  useEffect(() => {
    if ((level === 'red_alert' || level === 'exceeded') && lastAlertRef.current !== level) {
      lastAlertRef.current = level;
      hapticError();
    } else if ((level === 'yellow' || level === 'orange') && lastAlertRef.current !== level) {
      lastAlertRef.current = level;
      hapticWarning();
    } else if (level === 'green' && lastAlertRef.current !== 'green') {
      lastAlertRef.current = 'green';
    }
  }, [level]);

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surfaceVariant + '40', borderColor: statusColor + '40' }]}>
      {/* Cabecera del Meter */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Presupuesto {categoryName}
        </Text>
        <View style={[styles.badge, { backgroundColor: statusBg }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {badgeIcon} {totalProjectedPct.toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* Barra de progreso combinada (Gastado previo + Compra en curso) */}
      <View style={[styles.trackBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        {/* Fragmento consumido anteriormente */}
        {currentPct > 0 && (
          <View
            style={{
              height: '100%',
              width: `${currentPct}%`,
              backgroundColor: statusColor + '80',
              borderTopLeftRadius: 4,
              borderBottomLeftRadius: 4,
            }}
          />
        )}
        {/* Fragmento proyectado por la compra actual */}
        {newExpenseAmount > 0 && (
          <View
            style={{
              height: '100%',
              width: `${Math.min(100 - currentPct, newAmountPct)}%`,
              backgroundColor: statusColor,
              borderTopRightRadius: totalProjectedPct >= 100 ? 4 : 0,
              borderBottomRightRadius: totalProjectedPct >= 100 ? 4 : 0,
            }}
          />
        )}
      </View>

      {/* Detalle monetario dinámico */}
      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: statusColor, fontWeight: '600' }]}>
          {message}
        </Text>
        <Text style={[styles.footerSub, { color: theme.customColors.textSecondary }]}>
          Límite: {formatCurrency(budgetLimit)}
        </Text>
      </View>

      {/* Micro-consejo de Costo de Oportunidad / Disponible diario */}
      {opportunityAdvice && (
        <View style={[styles.adviceBox, { backgroundColor: statusBg }]}>
          <Text style={[styles.adviceText, { color: statusColor }]}>
            {opportunityAdvice}
          </Text>
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trackBar: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
  },
  footerSub: {
    fontSize: 10,
  },
  adviceBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
  adviceText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
});
