/**
 * ZenMoney — Custom Smart Calculator Numpad & BottomSheet Modal
 *
 * Teclado numérico interactivo con soporte para operaciones aritméticas (+, -, ×, ÷),
 * borrado rápido y presentación emergente deslizable (Bottom Sheet Modal) para no ocupar
 * espacio permanente en el formulario.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Pressable } from 'react-native';
import { Button, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomNumpadProps {
  /** Valor actual de la expresión o número */
  value: string;
  /** Callback al presionar una tecla */
  onChangeValue: (newValue: string) => void;
  /** Callback opcional al presionar el botón de confirmar / guardar */
  onConfirm?: () => void;
  /** Texto del botón de confirmación */
  confirmText?: string;
}

/**
 * Evalúa la expresión matemática ingresada de forma segura (ej. 35000+5 -> 35005)
 */
export const evaluateExpression = (expr: string): string => {
  try {
    if (!expr || expr === '0') return '0';
    
    let sanitized = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.')
      .replace(/[^0-9+\-*/.]/g, '');

    while (['+', '-', '*', '/'].includes(sanitized.slice(-1))) {
      sanitized = sanitized.slice(0, -1);
    }

    if (!sanitized) return '0';

    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${sanitized})`)();
    
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result).toString();
    }
    return expr;
  } catch (e) {
    return expr;
  }
};

export function CustomNumpad({
  value,
  onChangeValue,
  onConfirm,
  confirmText = 'Guardar',
}: CustomNumpadProps) {
  const theme = useAppTheme();

  const handleKeyPress = (key: string) => {
    let current = value || '';

    if (key === 'CLEAR') {
      onChangeValue('');
      return;
    }

    if (key === 'BACKSPACE') {
      if (current.length > 0) {
        onChangeValue(current.slice(0, -1));
      }
      return;
    }

    if (key === '=') {
      const evaluated = evaluateExpression(current);
      onChangeValue(evaluated);
      return;
    }

    if (['+', '-', '×', '÷'].includes(key)) {
      if (!current || current === '0') return;
      const lastChar = current.slice(-1);
      if (['+', '-', '×', '÷'].includes(lastChar)) {
        onChangeValue(current.slice(0, -1) + key);
      } else {
        onChangeValue(current + key);
      }
      return;
    }

    if (key === '00') {
      if (!current || current === '0') return;
      onChangeValue(current + '00');
      return;
    }

    if (current === '0') {
      onChangeValue(key);
    } else {
      onChangeValue(current + key);
    }
  };

  const handleConfirmAction = () => {
    const evaluated = evaluateExpression(value);
    onChangeValue(evaluated);
    if (onConfirm) onConfirm();
  };

  const renderKey = (
    label: string | React.ReactNode,
    actionKey: string,
    options?: { isOperator?: boolean; isAction?: boolean; flex?: number }
  ) => {
    const isOperator = options?.isOperator;
    const isAction = options?.isAction;

    return (
      <TouchableOpacity
        key={actionKey}
        style={[
          styles.key,
          {
            backgroundColor: isAction
              ? theme.colors.primary
              : isOperator
              ? theme.colors.surfaceVariant
              : theme.colors.elevation.level1,
          },
          options?.flex ? { flex: options.flex } : null,
        ]}
        activeOpacity={0.7}
        onPress={() => {
          if (actionKey === 'CONFIRM') {
            handleConfirmAction();
          } else {
            handleKeyPress(actionKey);
          }
        }}
      >
        {typeof label === 'string' ? (
          <Text
            style={[
              styles.keyText,
              {
                color: isAction
                  ? theme.colors.onPrimary
                  : isOperator
                  ? theme.colors.primary
                  : theme.colors.onSurface,
              },
            ]}
          >
            {label}
          </Text>
        ) : (
          label
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Fila 1 */}
      <View style={styles.row}>
        {renderKey('C', 'CLEAR', { isOperator: true })}
        {renderKey('÷', '÷', { isOperator: true })}
        {renderKey('×', '×', { isOperator: true })}
        {renderKey(
          <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.colors.error} />,
          'BACKSPACE',
          { isOperator: true }
        )}
      </View>

      {/* Fila 2 */}
      <View style={styles.row}>
        {renderKey('7', '7')}
        {renderKey('8', '8')}
        {renderKey('9', '9')}
        {renderKey('-', '-', { isOperator: true })}
      </View>

      {/* Fila 3 */}
      <View style={styles.row}>
        {renderKey('4', '4')}
        {renderKey('5', '5')}
        {renderKey('6', '6')}
        {renderKey('+', '+', { isOperator: true })}
      </View>

      {/* Fila 4 */}
      <View style={styles.row}>
        {renderKey('1', '1')}
        {renderKey('2', '2')}
        {renderKey('3', '3')}
        {renderKey('=', '=', { isOperator: true })}
      </View>

      {/* Fila 5: Cero, Doble cero y Confirmar */}
      <View style={styles.row}>
        {renderKey('0', '0')}
        {renderKey('00', '00')}
        {onConfirm
          ? renderKey(confirmText, 'CONFIRM', { isAction: true, flex: 2 })
          : renderKey('.', '.', { isOperator: true, flex: 2 })}
      </View>
    </View>
  );
}

interface NumpadBottomSheetProps {
  visible: boolean;
  value: string;
  onChangeValue: (val: string) => void;
  onClose: () => void;
  title?: string;
}

/**
 * Panel Deslizable Bottom Sheet que envuelve el Numpad en una ventana modal emergente.
 * Se muestra al tocar el campo de monto y se oculta al finalizar, manteniendo el formulario limpio.
 */
export function NumpadBottomSheet({
  visible,
  value,
  onChangeValue,
  onClose,
  title = 'Ingresar Monto',
}: NumpadBottomSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const handleClose = () => {
    const evaluated = evaluateExpression(value);
    onChangeValue(evaluated);
    onClose();
  };

  const formattedDisplay = /[+\-×÷]/.test(value)
    ? value
    : (parseFloat(value || '0') || 0).toLocaleString('es-CO');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Surface
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: Math.max(insets.bottom + 12, 24),
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />
          
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                {title}
              </Text>
              <Text style={[theme.typography.h2, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                $ {formattedDisplay}
              </Text>
            </View>
            <Button
              mode="contained"
              onPress={handleClose}
              compact
              style={{ borderRadius: 20 }}
            >
              Listo
            </Button>
          </View>

          {/* Keypad */}
          <CustomNumpad
            value={value}
            onChangeValue={onChangeValue}
            onConfirm={handleClose}
            confirmText="Aplicar"
          />
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  key: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    flex: 1,
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 8,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
});
