import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useDateStore } from '@/src/infrastructure/state/useDateStore';
import { useAppTheme } from '@/src/presentation/theme';

export const GlobalMonthSelector = () => {
  const theme = useAppTheme();
  const { selectedYear, selectedMonth, prevMonth, nextMonth } = useDateStore();

  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  return (
    <View style={styles.container}>
      <IconButton
        icon="chevron-left"
        size={20}
        onPress={prevMonth}
        iconColor={theme.colors.onSurface}
        style={styles.iconButton}
      />
      <Text style={[styles.text, theme.typography.body, { color: theme.colors.onSurface, fontWeight: 'bold' }]}>
        {monthNames[selectedMonth - 1]} {selectedYear}
      </Text>
      <IconButton
        icon="chevron-right"
        size={20}
        onPress={nextMonth}
        iconColor={theme.colors.onSurface}
        style={styles.iconButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconButton: {
    margin: 0,
  },
  text: {
    minWidth: 80,
    textAlign: 'center',
  },
});
