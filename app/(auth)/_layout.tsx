/**
 * ZenMoney — Layout de Autenticación
 *
 * Configura la navegación para el flujo de Login y Registro.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';

export default function AuthLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Iniciar Sesión' }} />
      <Stack.Screen name="register" options={{ title: 'Registrarse' }} />
    </Stack>
  );
}
