/**
 * ZenMoney — CreateAtomicHabitModal
 *
 * Modal interactivo que asiste al usuario en la traducción de un presupuesto mensual
 * hacia un hábito atómico concreto con micro-reglas (tope por ocasión, día sin gasto, frecuencia).
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, TextInput, Button, SegmentedButtons, HelperText } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { AtomicHabitType, CueTime } from '@/src/domain/entities/AtomicHabit';
import { CreateAtomicHabit } from '@/src/domain/usecases/CreateAtomicHabit';

interface CreateAtomicHabitModalProps {
  visible: boolean;
  budgetId: string;
  categoryId: string;
  categoryName: string;
  monthlyLimit: number;
  onDismiss: () => void;
  onHabitCreated: (habit: ReturnType<typeof CreateAtomicHabit.execute>) => void;
}

export const CreateAtomicHabitModal: React.FC<CreateAtomicHabitModalProps> = ({
  visible,
  budgetId,
  categoryId,
  categoryName,
  monthlyLimit,
  onDismiss,
  onHabitCreated,
}) => {
  const theme = useAppTheme();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<AtomicHabitType>('cap_per_occasion');
  const [amountStr, setAmountStr] = useState('');
  const [timeOfDayCue, setTimeOfDayCue] = useState<CueTime>('evening');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    try {
      const parsedAmount = parseFloat(amountStr) || 0;

      const ruleConfig = type === 'cap_per_occasion'
        ? { maxCapPerOccasion: parsedAmount }
        : type === 'no_spend_day'
        ? { noSpendDayOfWeek: 2 } // Martes por defecto
        : { dailyAllowance: parsedAmount };

      const habit = CreateAtomicHabit.execute({
        budgetId,
        categoryId,
        title: title || `Hábito de ${categoryName}`,
        type,
        ruleConfig,
        suggestedActionAmount: parsedAmount > 0 ? parsedAmount : undefined,
        timeOfDayCue,
        isEnabled: true,
      });

      onHabitCreated(habit);
      onDismiss();
    } catch (err: any) {
      setError(err.message || 'Error al crear hábito');
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
            Convertir Presupuesto en Hábito
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 16 }}>
            {categoryName} • Techo mensual: ${monthlyLimit.toLocaleString('es-CO')}
          </Text>

          {/* Tipo de Regla Atómica */}
          <Text variant="labelMedium" style={styles.fieldLabel}>
            Tipo de Micro-Regla
          </Text>
          <SegmentedButtons
            value={type}
            onValueChange={(val) => setType(val as AtomicHabitType)}
            buttons={[
              { value: 'cap_per_occasion', label: 'Tope Salida' },
              { value: 'no_spend_day', label: 'Día Cero' },
              { value: 'daily_allowance', label: 'Cuota Diaria' },
            ]}
            style={{ marginBottom: 16 }}
          />

          <TextInput
            label="Nombre del Hábito (ej. Almuerzos de oficina)"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
          />

          {type !== 'no_spend_day' && (
            <TextInput
              label={type === 'cap_per_occasion' ? 'Tope máximo por ocasión ($)' : 'Monto diario ($)'}
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />
          )}

          {/* Momento de Disparo (Cue) */}
          <Text variant="labelMedium" style={styles.fieldLabel}>
            Momento del Recordatorio (Cue)
          </Text>
          <SegmentedButtons
            value={timeOfDayCue}
            onValueChange={(val) => setTimeOfDayCue(val as CueTime)}
            buttons={[
              { value: 'morning', label: 'Mañana (8 AM)' },
              { value: 'afternoon', label: 'Tarde (1 PM)' },
              { value: 'evening', label: 'Noche (9 PM)' },
            ]}
            style={{ marginBottom: 16 }}
          />

          {error && <HelperText type="error" visible>{error}</HelperText>}

          <View style={styles.actions}>
            <Button onPress={onDismiss} style={{ marginRight: 8 }}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={handleSubmit}>
              Guardar Hábito
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    maxHeight: '85%',
  },
  title: {
    fontWeight: '800',
  },
  fieldLabel: {
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
});
