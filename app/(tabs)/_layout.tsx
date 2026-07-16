/**
 * ZenMoney — Layout de Navegación por Pestañas
 *
 * Configura la barra inferior (Tab Bar) con iconos y theming adaptativo de ZenMoney.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
  const barHeight = insets.bottom > 0 ? 56 + insets.bottom : 60;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitleStyle: {
          ...theme.typography.h3,
          color: theme.colors.onSurface,
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurface + '80', // Opacidad de 50%
        tabBarLabelStyle: {
          ...theme.typography.caption,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumen',
          tabBarLabel: 'Resumen',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Movimientos',
          tabBarLabel: 'Movimientos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="bills"
        options={{
          title: 'Facturas',
          tabBarLabel: 'Facturas',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Presupuestos',
          tabBarLabel: 'Presupuestos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-arc" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
