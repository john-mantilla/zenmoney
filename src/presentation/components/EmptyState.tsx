/**
 * ZenMoney — Componente EmptyState
 *
 * Muestra una ilustración sutil y un botón de llamada a la acción para listados vacíos.
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Button } from 'react-native-paper';
import { useAppTheme } from '../theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={icon as any}
        size={64}
        color={theme.colors.outline}
        style={styles.icon}
      />
      
      <Text style={[styles.title, theme.typography.h3, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      
      <Text style={[styles.description, theme.typography.bodySmall, { color: theme.customColors.textSecondary }]}>
        {description}
      </Text>

      {actionLabel && onAction && (
        <Button
          mode="contained"
          onPress={onAction}
          style={styles.button}
          labelStyle={theme.typography.button}
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    textAlign: 'center',
  },
  icon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 260,
  },
  button: {
    borderRadius: 8,
  },
});
