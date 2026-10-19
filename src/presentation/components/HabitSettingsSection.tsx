/**
 * ZenMoney — HabitSettingsSection (GUI Compacta y Plegable)
 *
 * Panel de configuración ergonómico y compacto para la funcionalidad de Hábitos Atómicos
 * y Safe-to-Spend. Organiza las opciones avanzadas y coloca el listado granular de categorías
 * en un acordeón plegable con scroll contenido y acciones rápidas ("Activar todas" / "Desactivar todas").
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Surface, Switch, Divider, List, Chip, TextInput, Button, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@/src/presentation/theme';
import { useHabitSettingsStore } from '@/src/infrastructure/state/habitSettingsStore';
import { Category } from '@/src/domain/entities/Category';

interface HabitSettingsSectionProps {
  categories?: Category[];
}

export const HabitSettingsSection: React.FC<HabitSettingsSectionProps> = ({
  categories = [],
}) => {
  const theme = useAppTheme();
  const {
    settings,
    setGloballyEnabled,
    setNotificationsEnabled,
    setWeekendWeightEnabled,
    setMicroSweepEnabled,
    setCategoryEnabled,
    setAllCategories,
    isCategoryActive,
  } = useHabitSettingsStore();

  // Estado del acordeón de categorías (cerrado por defecto para evitar pantallas largas)
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Estadísticas de categorías activas
  const activeCount = useMemo(() => {
    return categories.filter((c) => isCategoryActive(c.id)).length;
  }, [categories, isCategoryActive, settings.categoryOverrides, settings.isGloballyEnabled]);

  // Filtrar categorías en el acordeón según búsqueda
  const filteredCategories = useMemo(() => {
    if (!searchFilter.trim()) return categories;
    const term = searchFilter.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(term));
  }, [categories, searchFilter]);

  const allCategoryIds = useMemo(() => categories.map((c) => c.id), [categories]);

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]} elevation={1}>
      {/* ─── 1. INTERRUPTOR MAESTRO GLOBAL ──────────────────────────── */}
      <View style={styles.masterRow}>
        <View style={styles.masterInfo}>
          <View style={[styles.iconContainer, { backgroundColor: settings.isGloballyEnabled ? theme.colors.primaryContainer : theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons
              name="atom"
              size={24}
              color={settings.isGloballyEnabled ? theme.colors.primary : theme.colors.outline}
            />
          </View>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
              Hábitos Atómicos y Safe-to-Spend
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
              Disponible diario dinámico y micro-decisiones de gasto
            </Text>
          </View>
        </View>
        <Switch
          value={settings.isGloballyEnabled}
          onValueChange={setGloballyEnabled}
          color={theme.colors.primary}
        />
      </View>

      {settings.isGloballyEnabled && (
        <>
          <Divider style={styles.divider} />

          {/* ─── 2. OPCIONES AVANZADAS COMPACTAS ────────────────────────── */}
          <List.Item
            title="Ponderar Fin de Semana (1.5x)"
            titleStyle={{ fontSize: 14, fontWeight: '600', color: theme.colors.onSurface }}
            description="Mayor cuota de viernes a domingo compensando entre semana"
            descriptionStyle={{ fontSize: 11, color: theme.colors.outline }}
            left={(props) => <List.Icon {...props} icon="calendar-weekend" />}
            right={() => (
              <Switch
                value={settings.weekendWeightEnabled}
                onValueChange={setWeekendWeightEnabled}
                color={theme.colors.primary}
              />
            )}
            style={styles.compactListItem}
          />

          <Divider style={styles.subDivider} />

          <List.Item
            title="Notificaciones y Nudges"
            titleStyle={{ fontSize: 14, fontWeight: '600', color: theme.colors.onSurface }}
            description="Recordatorios sutiles con botones de registro en 1 toque"
            descriptionStyle={{ fontSize: 11, color: theme.colors.outline }}
            left={(props) => <List.Icon {...props} icon="bell-ring-outline" />}
            right={() => (
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                color={theme.colors.primary}
              />
            )}
            style={styles.compactListItem}
          />

          <Divider style={styles.subDivider} />

          <List.Item
            title="Micro-Sweep (Barrido de Ahorro)"
            titleStyle={{ fontSize: 14, fontWeight: '600', color: theme.colors.onSurface }}
            description="Transferir excedente diario no gastado a metas de ahorro"
            descriptionStyle={{ fontSize: 11, color: theme.colors.outline }}
            left={(props) => <List.Icon {...props} icon="piggy-bank-outline" />}
            right={() => (
              <Switch
                value={settings.microSweepEnabled}
                onValueChange={setMicroSweepEnabled}
                color={theme.colors.primary}
              />
            )}
            style={styles.compactListItem}
          />

          {/* ─── 3. ACORDEÓN PLEGABLE DE CATEGORÍAS ─────────────────────── */}
          {categories.length > 0 && (
            <>
              <Divider style={styles.divider} />

              <TouchableOpacity
                onPress={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                activeOpacity={0.7}
                style={styles.accordionHeader}
              >
                <View style={styles.accordionTitleRow}>
                  <MaterialCommunityIcons
                    name="folder-cog-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                      Personalizar por Categoría
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, fontSize: 11 }}>
                      {activeCount === categories.length
                        ? `Todas activas (${activeCount})`
                        : `${activeCount} de ${categories.length} activas`}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Chip
                    compact
                    textStyle={{ fontSize: 10, fontWeight: '700' }}
                    style={{
                      backgroundColor: activeCount === categories.length ? '#E0F2FE' : '#FEF3C7',
                    }}
                  >
                    {activeCount === categories.length ? 'Todas' : `${activeCount}/${categories.length}`}
                  </Chip>
                  <MaterialCommunityIcons
                    name={isCategoriesExpanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={theme.colors.onSurfaceVariant}
                  />
                </View>
              </TouchableOpacity>

              {/* Contenido desplegable con altura contenida y scroll interno */}
              {isCategoriesExpanded && (
                <View style={styles.accordionBody}>
                  {/* Barra de Búsqueda y Botones Rápidos */}
                  <View style={styles.controlsRow}>
                    <TextInput
                      mode="outlined"
                      dense
                      placeholder="Buscar categoría..."
                      value={searchFilter}
                      onChangeText={setSearchFilter}
                      left={<TextInput.Icon icon="magnify" size={18} />}
                      style={styles.searchInput}
                    />

                    <View style={styles.quickButtonsRow}>
                      <Button
                        compact
                        mode="text"
                        onPress={() => setAllCategories(true, allCategoryIds)}
                        labelStyle={{ fontSize: 11, fontWeight: '700' }}
                      >
                        Activar todas
                      </Button>
                      <Button
                        compact
                        mode="text"
                        textColor={theme.colors.error}
                        onPress={() => setAllCategories(false, allCategoryIds)}
                        labelStyle={{ fontSize: 11, fontWeight: '700' }}
                      >
                        Desactivar todas
                      </Button>
                    </View>
                  </View>

                  {/* Lista con altura máxima para evitar menús infinitos */}
                  <ScrollView
                    nestedScrollEnabled
                    style={styles.categoryScrollList}
                    showsVerticalScrollIndicator={true}
                  >
                    {filteredCategories.map((cat) => {
                      const active = isCategoryActive(cat.id);
                      return (
                        <View key={cat.id} style={styles.categoryItemRow}>
                          <View style={styles.categoryInfo}>
                            <View
                              style={[
                                styles.categoryColorDot,
                                { backgroundColor: cat.color || theme.colors.primary },
                              ]}
                            />
                            <Text
                              variant="bodyMedium"
                              style={{
                                color: active ? theme.colors.onSurface : theme.colors.outline,
                                fontWeight: active ? '600' : '400',
                                flex: 1,
                              }}
                              numberOfLines={1}
                            >
                              {cat.name}
                            </Text>
                          </View>
                          <Switch
                            value={active}
                            onValueChange={(val) => setCategoryEnabled(cat.id, val)}
                            color={theme.colors.primary}
                          />
                        </View>
                      );
                    })}

                    {filteredCategories.length === 0 && (
                      <Text style={styles.emptySearchText}>
                        No se encontraron categorías con "{searchFilter}"
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  masterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  divider: {
    marginVertical: 12,
  },
  subDivider: {
    marginVertical: 4,
    opacity: 0.5,
  },
  compactListItem: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accordionBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  controlsRow: {
    marginBottom: 8,
  },
  searchInput: {
    height: 36,
    fontSize: 13,
    marginBottom: 6,
  },
  quickButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  categoryScrollList: {
    maxHeight: 250,
    paddingRight: 4,
  },
  categoryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  categoryColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptySearchText: {
    textAlign: 'center',
    paddingVertical: 16,
    color: '#9CA3AF',
    fontSize: 12,
  },
});
