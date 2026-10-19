/**
 * ZenMoney — AccountIconPicker
 *
 * Selector visual interactivo para íconos de cuenta financiera con catálogo
 * embebido de alta fidelidad. Permite filtrar por tipo (Tarjetas, Bancos, Efectivo, Otros),
 * previsualizar en tiempo real y seleccionar fácilmente con retroalimentación háptica.
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/src/presentation/theme';
import {
  ACCOUNT_ICONS_CATALOG,
  AccountIconCategory,
  AccountIconDefinition,
} from '@/src/presentation/theme/accountIcons';
import { AccountIcon } from './AccountIcon';

export interface AccountIconPickerProps {
  selectedIcon?: string;
  onSelectIcon: (iconId: string) => void;
  accentColor?: string;
}

const CATEGORY_TABS: { key: AccountIconCategory; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'card', label: 'Tarjetas' },
  { key: 'bank', label: 'Bancos' },
  { key: 'cash', label: 'Efectivo' },
  { key: 'other', label: 'Otros' },
];

export const AccountIconPicker: React.FC<AccountIconPickerProps> = ({
  selectedIcon,
  onSelectIcon,
  accentColor,
}) => {
  const theme = useAppTheme();
  const [activeCategory, setActiveCategory] = useState<AccountIconCategory>('all');

  const filteredIcons = activeCategory === 'all'
    ? ACCOUNT_ICONS_CATALOG
    : ACCOUNT_ICONS_CATALOG.filter((i) => i.category === activeCategory);

  const handleSelect = (iconDef: AccountIconDefinition) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {
        // Haptics no soportado en este entorno
      }
    }
    onSelectIcon(iconDef.id);
  };

  const activeHighlight = accentColor || theme.colors.primary;

  return (
    <View style={styles.container}>
      {/* Selector de pestañas / filtros de categoría */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
        style={styles.tabsContainer}
      >
        {CATEGORY_TABS.map((tab) => {
          const isTabActive = activeCategory === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveCategory(tab.key)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isTabActive
                    ? activeHighlight + '18'
                    : 'transparent',
                  borderColor: isTabActive ? activeHighlight : theme.colors.outline + '30',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isTabActive ? activeHighlight : theme.customColors.textSecondary,
                    fontWeight: isTabActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Cuadrícula horizontal de íconos */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.iconsScrollContent}
      >
        {filteredIcons.map((iconItem) => {
          const isSelected = selectedIcon?.toLowerCase() === iconItem.id.toLowerCase();

          return (
            <Pressable
              key={iconItem.id}
              onPress={() => handleSelect(iconItem)}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar ícono ${iconItem.label}`}
              style={styles.itemWrapper}
            >
              <Surface
                elevation={isSelected ? 3 : 0}
                style={[
                  styles.iconCard,
                  {
                    backgroundColor: isSelected
                      ? activeHighlight + '12'
                      : theme.colors.surfaceVariant + '35',
                    borderColor: isSelected ? activeHighlight : theme.colors.outline + '25',
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <AccountIcon
                  icon={iconItem.id}
                  size={36}
                  backgroundColor={isSelected ? activeHighlight : iconItem.defaultColor}
                />

                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: activeHighlight }]}>
                    <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                  </View>
                )}
              </Surface>

              <Text
                numberOfLines={1}
                style={[
                  styles.itemLabel,
                  {
                    color: isSelected ? activeHighlight : theme.customColors.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {iconItem.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  tabsContainer: {
    marginBottom: 10,
  },
  tabsScrollContent: {
    gap: 6,
    paddingHorizontal: 2,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11,
  },
  iconsScrollContent: {
    gap: 12,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  itemWrapper: {
    alignItems: 'center',
    width: 62,
  },
  iconCard: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
