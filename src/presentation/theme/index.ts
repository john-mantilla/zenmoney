/**
 * ZenMoney — Configuración del Tema Base
 *
 * Integra nuestros tokens personalizados con React Native Paper (Material Design 3).
 */

import { MD3LightTheme, MD3DarkTheme, useTheme } from 'react-native-paper';
import { Colors } from './colors';
import { Spacing } from './spacing';
import { Typography } from './typography';
import { BorderRadius } from './borderRadius';
import { Shadows } from './shadows';

// Crear el tema extendido para React Native Paper
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.primary,
    primaryContainer: '#E6F4EE',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: Colors.light.primaryDark,
    secondary: Colors.light.secondary,
    secondaryContainer: '#F0F2F5',
    onSecondaryContainer: Colors.light.text,
    error: Colors.light.danger,
    errorContainer: Colors.light.dangerLight,
    background: Colors.light.background,
    surface: Colors.light.surface,
    surfaceVariant: Colors.light.surfaceVariant,
    onSurface: Colors.light.text,
    onSurfaceVariant: Colors.light.textSecondary,
    outline: Colors.light.border,
    outlineVariant: Colors.light.border,
  },
  // Custom tokens
  spacing: Spacing,
  typography: Typography,
  borderRadius: BorderRadius,
  shadows: Shadows,
  customColors: Colors.light,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Colors.dark.primary,
    primaryContainer: '#1E3D30',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#A3E6CA',
    secondary: '#818CF8',
    secondaryContainer: '#222736',
    onSecondaryContainer: '#F0F6FC',
    error: Colors.dark.danger,
    errorContainer: Colors.dark.dangerLight,
    background: Colors.dark.background,
    surface: Colors.dark.surface,
    surfaceVariant: Colors.dark.surfaceVariant,
    onSurface: Colors.dark.text,
    onSurfaceVariant: Colors.dark.textSecondary,
    outline: Colors.dark.border,
    outlineVariant: Colors.dark.border,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: Colors.dark.surface,
      level2: Colors.dark.surfaceVariant,
      level3: '#222736',
    },
  },
  // Custom tokens
  spacing: Spacing,
  typography: Typography,
  borderRadius: BorderRadius,
  shadows: Shadows,
  customColors: Colors.dark,
};

export type AppTheme = typeof lightTheme;

/** Hook personalizado para consumir el tema tipado de ZenMoney */
export const useAppTheme = () => useTheme<AppTheme>();

export * from './colors';
export * from './spacing';
export * from './typography';
export * from './borderRadius';
export * from './shadows';
