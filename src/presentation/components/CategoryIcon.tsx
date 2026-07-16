/**
 * ZenMoney — Componente CategoryIcon
 *
 * Muestra el icono de la categoría dentro de un círculo con un fondo suave de color.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CategoryIcon: React.FC<CategoryIconProps> = React.memo(({
  icon,
  color,
  size = 'md',
}) => {
  // Dimensiones del contenedor e icono
  let containerSize = 40;
  let iconSize = 20;

  if (size === 'sm') {
    containerSize = 32;
    iconSize = 16;
  } else if (size === 'lg') {
    containerSize = 56;
    iconSize = 28;
  }

  // Generar color de fondo con 15% de opacidad
  const backgroundColor = `${color}26`; // 26 hexadecimal equivale a ~15% de opacidad

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={iconSize}
        color={color}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
