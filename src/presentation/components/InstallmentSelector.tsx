/**
 * ZenMoney — InstallmentSelector Component
 * 
 * Componente unificado y reutilizable para diferir compras con tarjeta de crédito.
 * Soporta presets comunes (2, 3, 6, 12, 24, 36) y entrada numérica manual libre
 * (ej. 4, 5, 8, 10, etc.) con cálculo de cuotas mensuales en tiempo real.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Surface, Text, Switch, TextInput, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/src/presentation/theme';

export interface InstallmentSelectorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  count: number;
  onChangeCount: (count: number) => void;
  totalAmount: number;
  disabled?: boolean;
}

const PRESET_COUNTS = [2, 3, 6, 12, 24, 36];
const MIN_INSTALLMENTS = 2;
const MAX_INSTALLMENTS = 72;

export const InstallmentSelector: React.FC<InstallmentSelectorProps> = ({
  enabled,
  onToggle,
  count,
  onChangeCount,
  totalAmount,
  disabled = false,
}) => {
  const theme = useAppTheme();
  
  const isCustomCount = !PRESET_COUNTS.includes(count);
  const [isCustomMode, setIsCustomMode] = useState(isCustomCount);
  const [customInputText, setCustomInputText] = useState(String(count));

  // Sincronizar el texto del input si cambia externamente el count
  useEffect(() => {
    setCustomInputText(String(count));
    if (!PRESET_COUNTS.includes(count)) {
      setIsCustomMode(true);
    }
  }, [count]);

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
    if (val && (!count || count <= 1)) {
      onChangeCount(3);
      setIsCustomMode(false);
    }
  };

  const handleSelectPreset = (preset: number) => {
    triggerHaptic();
    setIsCustomMode(false);
    setCustomInputText(String(preset));
    onChangeCount(preset);
  };

  const handleCustomModePress = () => {
    triggerHaptic();
    setIsCustomMode(true);
    const initialCustom = PRESET_COUNTS.includes(count) ? 4 : count;
    setCustomInputText(String(initialCustom));
    onChangeCount(initialCustom);
  };

  const handleCustomInputChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setCustomInputText(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= MIN_INSTALLMENTS && num <= MAX_INSTALLMENTS) {
      onChangeCount(num);
    }
  };

  const handleStepCustom = (delta: number) => {
    triggerHaptic();
    const current = parseInt(customInputText, 10) || count || MIN_INSTALLMENTS;
    const nextVal = Math.min(MAX_INSTALLMENTS, Math.max(MIN_INSTALLMENTS, current + delta));
    setCustomInputText(String(nextVal));
    onChangeCount(nextVal);
  };

  const safeCount = Math.max(MIN_INSTALLMENTS, count || MIN_INSTALLMENTS);
  const safeTotal = Math.max(0, totalAmount || 0);
  const monthlyAmount = Math.round(safeTotal / safeCount);

  return (
    <Surface
      style={[
        theme.shadows.sm,
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: enabled ? '#8B5CF680' : theme.colors.outline + '40',
        },
      ]}
    >
      {/* Cabecera con Switch */}
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: enabled ? '#8B5CF620' : theme.colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="credit-card-clock-outline"
              size={18}
              color={enabled ? '#8B5CF6' : theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, styles.title, { color: theme.colors.onSurface }]}>
              Diferir compra a cuotas
            </Text>
            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11 }]}>
              {enabled
                ? `${safeCount} cuotas de $${monthlyAmount.toLocaleString('es-CO')}/mes`
                : 'Pagar en varios meses (Tarjeta de Crédito)'}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          disabled={disabled}
          color="#8B5CF6"
        />
      </View>

      {/* Contenido expandido cuando está habilitado */}
      {enabled && (
        <View style={[styles.bodyContent, { borderTopColor: theme.colors.outline + '20' }]}>
          <Text style={[theme.typography.caption, styles.sectionLabel, { color: theme.customColors.textSecondary }]}>
            Número de cuotas:
          </Text>

          {/* Carrusel horizontal de píldoras de cuotas */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsScroll}
          >
            {PRESET_COUNTS.map((preset) => {
              const isSelected = !isCustomMode && count === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => handleSelectPreset(preset)}
                  disabled={disabled}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isSelected ? '#8B5CF6' : theme.colors.surfaceVariant,
                      borderColor: isSelected ? '#8B5CF6' : theme.colors.outline + '40',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.onSurface },
                    ]}
                  >
                    {preset}
                  </Text>
                </Pressable>
              );
            })}

            {/* Píldora para cuota personalizada */}
            <Pressable
              onPress={handleCustomModePress}
              disabled={disabled}
              style={[
                styles.pill,
                styles.customPill,
                {
                  backgroundColor: isCustomMode ? '#8B5CF6' : theme.colors.surfaceVariant,
                  borderColor: isCustomMode ? '#8B5CF6' : theme.colors.outline + '40',
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
                {isCustomMode ? `${count} cuotas` : 'Otro...'}
              </Text>
            </Pressable>
          </ScrollView>

          {/* Panel de entrada manual cuando está en modo personalizado */}
          {isCustomMode && (
            <View style={[styles.customInputContainer, { backgroundColor: '#8B5CF60F' }]}>
              <Text style={[theme.typography.caption, { color: '#6D28D9', fontWeight: '600' }]}>
                Plazo exacto:
              </Text>
              <View style={styles.stepperRow}>
                <IconButton
                  icon="minus"
                  size={16}
                  mode="contained-tonal"
                  disabled={disabled || count <= MIN_INSTALLMENTS}
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
                  disabled={disabled || count >= MAX_INSTALLMENTS}
                  onPress={() => handleStepCustom(1)}
                  style={styles.stepperBtn}
                />
                <Text style={[theme.typography.caption, { color: '#6D28D9', fontWeight: '700', marginLeft: 4 }]}>
                  meses (2 a 72)
                </Text>
              </View>
            </View>
          )}

          {/* Tarjeta Educativa de Impacto Contable y Financiero */}
          <View style={[styles.impactCard, { backgroundColor: '#8B5CF612', borderColor: '#8B5CF630' }]}>
            <Text style={[theme.typography.caption, styles.impactTitle, { color: '#6D28D9' }]}>
              💡 Impacto Contable y Financiero
            </Text>
            <Text style={[theme.typography.caption, styles.impactText, { color: '#5B21B6' }]}>
              • Tu tarjeta registrará la deuda total de ${safeTotal.toLocaleString('es-CO')} hoy.{'\n'}
              • Tus gastos mensuales computarán solo ${monthlyAmount.toLocaleString('es-CO')} en cada uno de los {safeCount} meses, protegiendo tus presupuestos.
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
    minWidth: 42,
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
