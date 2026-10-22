/**
 * ZenMoney — ScenarioSimulatorCard
 *
 * Tarjeta interactiva para simular créditos y compras a cuotas en memoria.
 * Calcula en tiempo real la cuota fija (sistema francés), intereses y plazo.
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Surface, Text, TextInput, Button, SegmentedButtons, HelperText } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { LoanScenarioInput, ScenarioType, InterestRateType } from '@/src/domain/entities/LoanScenario';
import {
  annualEffectiveToMonthlyRate,
  normalizeMonthlyRate,
  calculateMonthlyInstallment,
} from '@/src/domain/utils/financialMath';

export interface ScenarioSimulatorCardProps {
  onApplyScenario: (scenario: LoanScenarioInput) => void;
  onClose: () => void;
  initialScenario?: LoanScenarioInput | null;
}

export const ScenarioSimulatorCard: React.FC<ScenarioSimulatorCardProps> = ({
  onApplyScenario,
  onClose,
  initialScenario,
}) => {
  const theme = useAppTheme();

  const [name, setName] = useState(initialScenario?.name || 'Simulación de Crédito');
  const [type, setType] = useState<ScenarioType>(initialScenario?.type || 'card_purchase');
  const [principalStr, setPrincipalStr] = useState(initialScenario ? String(initialScenario.principal) : '2000000');
  const [monthsStr, setMonthsStr] = useState(initialScenario ? String(initialScenario.months) : '12');
  const [interestStr, setInterestStr] = useState(initialScenario ? String(initialScenario.interestRate) : '2.0');
  const [rateType, setRateType] = useState<InterestRateType>(initialScenario?.rateType || 'EM');

  // Cálculos dinámicos en vivo
  const calculations = useMemo(() => {
    const principal = parseFloat(principalStr.replace(/[^0-9.]/g, '')) || 0;
    const months = parseInt(monthsStr.replace(/[^0-9]/g, ''), 10) || 1;
    const rawRate = parseFloat(interestStr.replace(/[^0-9.]/g, '')) || 0;

    const monthlyRate =
      rateType === 'EA'
        ? annualEffectiveToMonthlyRate(rawRate)
        : normalizeMonthlyRate(rawRate);

    const installment = calculateMonthlyInstallment(principal, monthlyRate, months);
    const totalPaid = installment * months;
    const totalInterest = Math.max(0, totalPaid - principal);

    return {
      principal,
      months,
      rawRate,
      monthlyRate,
      installment,
      totalPaid,
      totalInterest,
    };
  }, [principalStr, monthsStr, interestStr, rateType]);

  const handleApply = () => {
    if (calculations.principal <= 0) return;
    onApplyScenario({
      name: name.trim() || 'Simulación',
      type,
      principal: calculations.principal,
      months: calculations.months,
      interestRate: calculations.rawRate,
      rateType,
      startDate: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.iconCircle, { backgroundColor: '#8A05BE18' }]}>
            <MaterialCommunityIcons name="calculator-variant-outline" size={20} color="#8A05BE" />
          </View>
          <Text style={[theme.typography.h3, { fontSize: 16, color: theme.colors.onSurface }]}>
            Simulador de Escenarios What-If
          </Text>
        </View>
        <Button mode="text" compact onPress={onClose} textColor={theme.customColors.textSecondary}>
          Cerrar
        </Button>
      </View>

      <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 12 }]}>
        Modela una compra o crédito y observa en tiempo real cómo impactará tu liquidez antes de comprometerte.
      </Text>

      {/* Tipo de Escenario */}
      <SegmentedButtons
        value={type}
        onValueChange={(val) => setType(val as ScenarioType)}
        buttons={[
          { value: 'card_purchase', label: 'Compra Tarjeta (TDC)' },
          { value: 'loan', label: 'Préstamo Bancario' },
        ]}
        density="small"
        style={{ marginBottom: 12 }}
      />

      {/* Nombre */}
      <TextInput
        label="Concepto / Nombre del Escenario"
        value={name}
        onChangeText={setName}
        mode="outlined"
        dense
        style={{ marginBottom: 8 }}
      />

      {/* Monto Principal */}
      <TextInput
        label="Monto Financiado ($ COP)"
        value={principalStr}
        onChangeText={setPrincipalStr}
        keyboardType="numeric"
        mode="outlined"
        dense
        style={{ marginBottom: 8 }}
      />

      {/* Plazo y Tasa en Fila */}
      <View style={styles.rowInputs}>
        <View style={{ flex: 1 }}>
          <TextInput
            label="Plazo (Meses)"
            value={monthsStr}
            onChangeText={setMonthsStr}
            keyboardType="numeric"
            mode="outlined"
            dense
          />
        </View>

        <View style={{ flex: 1.2 }}>
          <TextInput
            label={`Tasa (${rateType})`}
            value={interestStr}
            onChangeText={setInterestStr}
            keyboardType="numeric"
            mode="outlined"
            dense
            right={<TextInput.Affix text="%" />}
          />
        </View>

        <View style={{ width: 85, marginTop: 6 }}>
          <SegmentedButtons
            value={rateType}
            onValueChange={(val) => setRateType(val as InterestRateType)}
            buttons={[
              { value: 'EM', label: 'E.M.' },
              { value: 'EA', label: 'E.A.' },
            ]}
            density="small"
          />
        </View>
      </View>

      {/* Chips Rápidos de Plazo */}
      <View style={styles.quickMonthsRow}>
        <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
          Plazos comunes:
        </Text>
        {[3, 6, 12, 24, 36].map((m) => (
          <Button
            key={m}
            mode={parseInt(monthsStr, 10) === m ? 'contained-tonal' : 'text'}
            compact
            onPress={() => setMonthsStr(String(m))}
            style={{ minWidth: 32, marginHorizontal: 2 }}
            labelStyle={{ fontSize: 11 }}
          >
            {m}m
          </Button>
        ))}
      </View>

      {/* Resumen Calculado en Vivo */}
      <Surface style={styles.summaryBox} elevation={0}>
        <View style={styles.summaryItem}>
          <Text style={{ fontSize: 11, color: theme.customColors.textSecondary }}>Cuota Mensual Estimada</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#8A05BE', marginTop: 2 }}>
            ${calculations.installment.toLocaleString('es-CO')}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={{ fontSize: 11, color: theme.customColors.textSecondary }}>Intereses Totales</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.onSurface, marginTop: 2 }}>
            ${calculations.totalInterest.toLocaleString('es-CO')}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={{ fontSize: 11, color: theme.customColors.textSecondary }}>Total a Pagar</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.onSurface, marginTop: 2 }}>
            ${calculations.totalPaid.toLocaleString('es-CO')}
          </Text>
        </View>
      </Surface>

      {/* Botón Aplicar */}
      <Button
        mode="contained"
        icon="chart-timeline-variant"
        onPress={handleApply}
        style={styles.applyButton}
        buttonColor="#8A05BE"
      >
        Superponer en la Gráfica
      </Button>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#8A05BE30',
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  quickMonthsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryBox: {
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E9D5FF',
  },
  applyButton: {
    borderRadius: 10,
  },
});
