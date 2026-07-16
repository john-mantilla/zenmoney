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
    primaryContainer: Colors.light.primaryLight,
    onPrimary: '#FFFFFF',
    secondary: Colors.light.secondary,
    error: Colors.light.danger,
    errorContainer: Colors.light.dangerLight,
    background: Colors.light.background,
    surface: Colors.light.surface,
    surfaceVariant: Colors.light.surfaceVariant,
    onSurface: Colors.light.text,
    outline: Colors.light.border,
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
    primaryContainer: Colors.dark.primaryDark,
    onPrimary: '#FFFFFF',
    secondary: Colors.dark.secondary,
    error: Colors.dark.danger,
    errorContainer: Colors.dark.dangerLight,
    background: Colors.dark.background,
    surface: Colors.dark.surface,
    surfaceVariant: Colors.dark.surfaceVariant,
    onSurface: Colors.dark.text,
    outline: Colors.dark.border,
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
