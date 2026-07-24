/**
 * ZenMoney — Layout de Navegación por Pestañas
 *
 * Configura la barra inferior (Tab Bar) con iconos y theming adaptativo de ZenMoney.
 */

import React from 'react';
import { Text, ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalMonthSelector } from '@/src/presentation/components';

export default function TabLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
  const barHeight = insets.bottom > 0 ? 58 + insets.bottom : 62;

  /**
   * Renderiza la etiqueta del tab únicamente cuando la pestaña está activa (focused).
   * Evita cualquier saturación o truncamiento de texto en la navegación principal.
   */
  const renderTabBarLabel = (label: string) => {
    return ({ focused, color }: { focused: boolean; color: ColorValue }) => {
      if (!focused) return null;
      return (
        <Text
          style={{
            color,
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          }}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {label}
        </Text>
      );
    };
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => <GlobalMonthSelector />,
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumen',
          tabBarLabel: renderTabBarLabel('Resumen'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Movimientos',
          tabBarLabel: renderTabBarLabel('Gastos'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="bills"
        options={{
          title: 'Facturas',
          tabBarLabel: renderTabBarLabel('Facturas'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Presupuestos',
          tabBarLabel: renderTabBarLabel('Plan'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-arc" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarLabel: renderTabBarLabel('Ajustes'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

