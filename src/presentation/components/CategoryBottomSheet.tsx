/**
 * ZenMoney — CategoryBottomSheet Component
 *
 * Modal BottomSheet deslizable para la selección elegante de categorías y subcategorías.
 * Muestra las categorías con íconos vectoriales en círculos cromáticos y subcategorías indentadas.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
} from 'react-native';
import { Surface, Divider, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../theme';
import { Category } from '@/src/domain/entities/Category';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CategoryBottomSheetProps {
  visible: boolean;
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
  excludeNamesContaining?: string;
}

export const CategoryBottomSheet: React.FC<CategoryBottomSheetProps> = ({
  visible,
  categories,
  selectedCategoryId,
  onSelect,
  onClose,
  excludeNamesContaining,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const visibleCategories = excludeNamesContaining
    ? categories.filter((c) => !c.name.toLowerCase().includes(excludeNamesContaining.toLowerCase()))
    : categories;

  const parents = visibleCategories.filter((c) => !c.parentCategoryId);
  const childrenOf = (parentId: string) => visibleCategories.filter((c) => c.parentCategoryId === parentId);

  const handleSelectCategory = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Surface
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: theme.colors.surface,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
              elevation={5}
            >
              {/* Barra superior de arrastre */}
              <View style={styles.dragHandleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: theme.colors.outline + '60' }]} />
              </View>

              {/* Cabecera */}
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="shape-outline" size={24} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.headerTitle, theme.typography.h3, { color: theme.colors.onSurface }]}>
                    Seleccionar Categoría
                  </Text>
                </View>
                <IconButton icon="close" size={22} onPress={onClose} />
              </View>

              <Divider style={{ marginBottom: 8 }} />

              {/* Lista de Categorías y Subcategorías */}
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {parents.map((parent) => {
                  const children = childrenOf(parent.id);
                  const isParentSelected = selectedCategoryId === parent.id;

                  return (
                    <View key={parent.id} style={styles.categoryBlock}>
                      {/* Categoría Padre */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleSelectCategory(parent.id)}
                        style={[
                          styles.parentRow,
                          isParentSelected && {
                            backgroundColor: theme.colors.primaryContainer + '60',
                            borderRadius: 12,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.iconCircle,
                            { backgroundColor: (parent.color || theme.colors.primary) + '20' },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={(parent.icon as any) || 'folder-outline'}
                            size={20}
                            color={parent.color || theme.colors.primary}
                          />
                        </View>

                        <Text
                          style={[
                            styles.parentName,
                            theme.typography.body,
                            {
                              color: isParentSelected ? theme.colors.primary : theme.colors.onSurface,
                              fontWeight: isParentSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {parent.name}
                        </Text>

                        {isParentSelected && (
                          <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>

                      {/* Subcategorías Hijos */}
                      {children.map((child) => {
                        const isChildSelected = selectedCategoryId === child.id;
                        return (
                          <TouchableOpacity
                            key={child.id}
                            activeOpacity={0.7}
                            onPress={() => handleSelectCategory(child.id)}
                            style={[
                              styles.childRow,
                              isChildSelected && {
                                backgroundColor: theme.colors.primaryContainer + '40',
                                borderRadius: 10,
                              },
                            ]}
                          >
                            <View style={styles.childIndent}>
                              <MaterialCommunityIcons
                                name="subdirectory-arrow-right"
                                size={18}
                                color={theme.customColors.textSecondary}
                              />
                            </View>

                            <Text
                              style={[
                                styles.childName,
                                theme.typography.bodySmall,
                                {
                                  color: isChildSelected ? theme.colors.primary : theme.colors.onSurface,
                                  fontWeight: isChildSelected ? '700' : '400',
                                },
                              ]}
                            >
                              {child.name}
                            </Text>

                            {isChildSelected && (
                              <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>
            </Surface>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    maxHeight: '80%',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  categoryBlock: {
    marginBottom: 8,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  parentName: {
    flex: 1,
    fontSize: 15,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 24,
    paddingRight: 8,
    marginLeft: 16,
  },
  childIndent: {
    marginRight: 10,
  },
  childName: {
    flex: 1,
    fontSize: 14,
  },
});
