/**
 * ZenMoney — CategoryPickerMenu
 *
 * Selector de categoría en lista desplegable (Menu) que respeta la jerarquía
 * categoría/subcategoría: cada categoría padre aparece seguida, indentada, de
 * sus subcategorías — todo en una sola lista continua y escaneable, en vez de
 * dos filas de chips desconectadas.
 */

import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Menu } from 'react-native-paper';
import { Category } from '@domain/entities/Category';

interface CategoryPickerMenuProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  label?: string;
  disabled?: boolean;
  /** Oculta categorías cuyo nombre contenga este texto (ej. "ingreso" en selectores de gasto). */
  excludeNamesContaining?: string;
  style?: any;
}

export const CategoryPickerMenu: React.FC<CategoryPickerMenuProps> = ({
  categories,
  selectedCategoryId,
  onSelect,
  label = 'Seleccionar Categoría',
  disabled,
  excludeNamesContaining,
  style,
}) => {
  const [visible, setVisible] = useState(false);

  const visibleCategories = excludeNamesContaining
    ? categories.filter((c) => !c.name.toLowerCase().includes(excludeNamesContaining.toLowerCase()))
    : categories;

  const parents = visibleCategories.filter((c) => !c.parentCategoryId);
  const childrenOf = (parentId: string) => visibleCategories.filter((c) => c.parentCategoryId === parentId);

  const selected = categories.find((c) => c.id === selectedCategoryId);

  const handleSelect = (id: string) => {
    onSelect(id);
    setVisible(false);
  };

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button
          mode="outlined"
          onPress={() => setVisible(true)}
          icon={selected?.icon || 'tag-outline'}
          disabled={disabled}
          contentStyle={{ justifyContent: 'flex-start' }}
          style={style}
        >
          {selected?.name || label}
        </Button>
      }
    >
      <ScrollView style={{ maxHeight: 340 }}>
        {parents.map((parent) => {
          const children = childrenOf(parent.id);
          return (
            <View key={parent.id}>
              <Menu.Item
                onPress={() => handleSelect(parent.id)}
                title={parent.name}
                leadingIcon={parent.icon || 'tag-outline'}
                trailingIcon={selectedCategoryId === parent.id ? 'check' : undefined}
              />
              {children.map((child) => (
                <Menu.Item
                  key={child.id}
                  onPress={() => handleSelect(child.id)}
                  title={child.name}
                  leadingIcon="subdirectory-arrow-right"
                  trailingIcon={selectedCategoryId === child.id ? 'check' : undefined}
                  style={{ marginLeft: 16 }}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Menu>
  );
};
