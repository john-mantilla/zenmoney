/**
 * ZenMoney — PeriodSplitSelector Component
 *
 * Selector reutilizable para prorratear y amortizar gastos grandes
 * en N meses (2 a 36) para suavizar su impacto en presupuestos y Safe-to-Spend.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Surface, Text, Switch, TextInput, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/src/presentation/theme';

export interface PeriodSplitSelectorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  totalMonths: number;
  onChangeMonths: (months: number) => void;
  totalAmount: number;
  transactionDate?: string;
  disabled?: boolean;
}

const PRESET_MONTHS = [3, 6, 12, 24, 36];
const MIN_MONTHS = 2;
const MAX_MONTHS = 36;

export const PeriodSplitSelector: React.FC<PeriodSplitSelectorProps> = ({
  enabled,
  onToggle,
  totalMonths,
  onChangeMonths,
  totalAmount,
  transactionDate,
  disabled = false,
}) => {
  const theme = useAppTheme();

  const isCustomMonth = !PRESET_MONTHS.includes(totalMonths);
  const [isCustomMode, setIsCustomMode] = useState(isCustomMonth);
  const [customInputText, setCustomInputText] = useState(String(totalMonths));

  useEffect(() => {
    setCustomInputText(String(totalMonths));
    if (!PRESET_MONTHS.includes(totalMonths)) {
      setIsCustomMode(true);
    }
  }, [totalMonths]);

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
    } catch (_) {}
  };

  const handleToggle = (val: boolean) => {
    triggerHaptic();
    onToggle(val);
    if (val && (!totalMonths || totalMonths <= 1)) {
      onChangeMonths(12);
      setIsCustomMode(false);
    }
  };

  const handleSelectPreset = (preset: number) => {
    triggerHaptic();
    setIsCustomMode(false);
    setCustomInputText(String(preset));
    onChangeMonths(preset);
  };

  const handleCustomModePress = () => {
    triggerHaptic();
    setIsCustomMode(true);
    const initialCustom = PRESET_MONTHS.includes(totalMonths) ? 4 : totalMonths;
    setCustomInputText(String(initialCustom));
    onChangeMonths(initialCustom);
  };

  const handleCustomInputChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setCustomInputText(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= MIN_MONTHS && num <= MAX_MONTHS) {
      onChangeMonths(num);
    }
  };

  const handleStepCustom = (delta: number) => {
    triggerHaptic();
    const current = parseInt(customInputText, 10) || totalMonths || MIN_MONTHS;
    const nextVal = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, current + delta));
    setCustomInputText(String(nextVal));
    onChangeMonths(nextVal);
  };

  const safeMonths = Math.max(MIN_MONTHS, Math.min(MAX_MONTHS, totalMonths || MIN_MONTHS));
  const safeTotal = Math.max(0, totalAmount || 0);
  const monthlyAmount = Math.round(safeTotal / safeMonths);

  // Calcular meses de inicio y fin
  const dateBase = transactionDate ? new Date(transactionDate + 'T00:00:00') : new Date();
  const startMonthStr = `${dateBase.getFullYear()}-${String(dateBase.getMonth() + 1).padStart(2, '0')}`;
  const endDate = new Date(dateBase.getFullYear(), dateBase.getMonth() + safeMonths - 1, 1);
  const endMonthStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

  return (
    <Surface
      style={[
        theme.shadows.sm,
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: enabled ? '#0284C780' : theme.colors.outline + '40',
        },
      ]}
    >
      {/* Cabecera con Switch */}
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: enabled ? '#0284C720' : theme.colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="calendar-sync-outline"
              size={18}
              color={enabled ? '#0284C7' : theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, styles.title, { color: theme.colors.onSurface }]}>
              Prorratear en presupuestos (Amortización)
            </Text>
            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
              {enabled
                ? `${safeMonths} meses de $${monthlyAmount.toLocaleString('es-CO')}/mes`
                : 'Suavizar impacto de gasto grande en N meses'}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          disabled={disabled}
          color="#0284C7"
        />
      </View>

      {/* Contenido expandido cuando está habilitado */}
      {enabled && (
        <View style={[styles.bodyContent, { borderTopColor: theme.colors.outline + '20' }]}>
          <Text style={[theme.typography.caption, styles.sectionLabel, { color: theme.customColors.textSecondary }]}>
            Meses de amortización:
          </Text>

          {/* Carrusel horizontal de píldoras de meses */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsScroll}
          >
            {PRESET_MONTHS.map((preset) => {
              const isSelected = !isCustomMode && totalMonths === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => handleSelectPreset(preset)}
                  disabled={disabled}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isSelected ? '#0284C7' : theme.colors.surfaceVariant,
                      borderColor: isSelected ? '#0284C7' : theme.colors.outline + '40',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.onSurface },
                    ]}
                  >
                    {preset}m
                  </Text>
                </Pressable>
              );
            })}

            {/* Píldora para plazo personalizado */}
            <Pressable
              onPress={handleCustomModePress}
              disabled={disabled}
              style={[
                styles.pill,
                styles.customPill,
                {
                  backgroundColor: isCustomMode ? '#0284C7' : theme.colors.surfaceVariant,
                  borderColor: isCustomMode ? '#0284C7' : theme.colors.outline + '40',
                },
              ]}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={13}
                color={isCustomMode ? '#FFFFFF' : theme.colors.onSurface}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.pillText,
                  { color: isCustomMode ? '#FFFFFF' : theme.colors.onSurface },
                ]}
              >
                {isCustomMode ? `${totalMonths} meses` : 'Otro...'}
              </Text>
            </Pressable>
          </ScrollView>

          {/* Panel de entrada manual cuando está en modo personalizado */}
          {isCustomMode && (
            <View style={[styles.customInputContainer, { backgroundColor: '#0284C70F' }]}>
              <Text style={[theme.typography.caption, { color: '#0369A1', fontWeight: '600' }]}>
                Meses exactos:
              </Text>
              <View style={styles.stepperRow}>
                <IconButton
                  icon="minus"
                  size={16}
                  mode="contained-tonal"
                  disabled={disabled || totalMonths <= MIN_MONTHS}
                  onPress={() => handleStepCustom(-1)}
                  style={styles.stepperBtn}
                />
                <TextInput
                  value={customInputText}
                  onChangeText={handleCustomInputChange}
                  keyboardType="numeric"
                  mode="outlined"
                  dense
                  style={styles.customTextInput}
                  disabled={disabled}
                  maxLength={2}
                />
                <IconButton
                  icon="plus"
                  size={16}
                  mode="contained-tonal"
                  disabled={disabled || totalMonths >= MAX_MONTHS}
                  onPress={() => handleStepCustom(1)}
                  style={styles.stepperBtn}
                />
                <Text style={[theme.typography.caption, { color: '#0369A1', fontWeight: '700', marginLeft: 4 }]}>
                  meses (2 a 36)
                </Text>
              </View>
            </View>
          )}

          {/* Tarjeta Educativa y Simulación de Impacto */}
          <View style={[styles.impactCard, { backgroundColor: '#0284C712', borderColor: '#0284C730' }]}>
            <Text style={[theme.typography.caption, styles.impactTitle, { color: '#0369A1' }]}>
              🗓️ Amortización Contable Interna ({startMonthStr} a {endMonthStr})
            </Text>
            <Text style={[theme.typography.caption, styles.impactText, { color: '#075985' }]}>
              • Tu cuenta descontará el monto completo de ${safeTotal.toLocaleString('es-CO')} en la fecha real de pago.{'\n'}
              • Tu presupuesto absorberá solo ${monthlyAmount.toLocaleString('es-CO')}/mes durante {safeMonths} meses, protegiendo tu Safe-to-Spend sin inflar este mes.{'\n'}
              • No genera cuotas bancarias ni deudas futuras.
            </Text>
          </View>
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    fontSize: 13,
  },
  bodyContent: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  sectionLabel: {
    marginBottom: 8,
    fontWeight: '600',
  },
  presetsScroll: {
    gap: 8,
    paddingBottom: 6,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
  },
  customPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pillText: {
    fontWeight: '700',
    fontSize: 12,
  },
  customInputContainer: {
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperBtn: {
    margin: 0,
    width: 28,
    height: 28,
  },
  customTextInput: {
    width: 48,
    height: 34,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  impactCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  impactTitle: {
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 2,
  },
  impactText: {
    fontSize: 11,
    lineHeight: 15,
  },
});
