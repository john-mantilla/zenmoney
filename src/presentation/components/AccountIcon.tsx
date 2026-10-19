/**
 * ZenMoney — AccountIcon
 *
 * Componente híbrido de renderizado de icono para cuentas financieras.
 * Soporta de manera prioritaria el catálogo embebido de alta resolución (Amex, Visa,
 * MasterCard, Bank, Cash, CheckBook, Dollar, Crypto), URIs de imagen y fallback
 * vectorial a MaterialCommunityIcons.
 */

import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getCatalogIcon } from '@/src/presentation/theme/accountIcons';

export interface AccountIconProps {
  icon?: string | null;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export const AccountIcon: React.FC<AccountIconProps> = ({
  icon,
  size = 36,
  color = '#FFFFFF',
  backgroundColor,
  style,
  imageStyle,
}) => {
  const catalogItem = getCatalogIcon(icon);

  // 1. Catálogo embebido (Amex, Visa, MasterCard, etc.)
  if (catalogItem) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: backgroundColor || 'transparent',
          },
          style,
        ]}
      >
        <Image
          source={catalogItem.source}
          style={[
            {
              width: Math.round(size * 0.68),
              height: Math.round(size * 0.68),
              resizeMode: 'contain',
            },
            imageStyle,
          ]}
        />
      </View>
    );
  }

  // 2. URI de imagen externa o local
  if (icon && (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('file://'))) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: backgroundColor || 'rgba(0,0,0,0.05)',
          },
          style,
        ]}
      >
        <Image
          source={{ uri: icon }}
          style={[
            {
              width: size,
              height: size,
              resizeMode: 'cover',
            },
            imageStyle,
          ]}
        />
      </View>
    );
  }

  // 3. Fallback vectorial (MaterialCommunityIcons)
  const iconName = (icon as any) || 'bank';
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor || '#2563EB',
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={iconName}
        size={Math.round(size * 0.58)}
        color={color}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
