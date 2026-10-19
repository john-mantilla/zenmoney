/**
 * ZenMoney — HabitSettingsSection
 *
 * Panel de configuración que permite al usuario habilitar o deshabilitar la funcionalidad
 * de Hábitos Atómicos y Safe-to-Spend tanto a nivel global como de forma granular por categoría.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Switch, Divider, List } from 'react-native-paper';
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
    isCategoryActive,
  } = useHabitSettingsStore();

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]} elevation={1}>
      {/* Interruptor Maestro Global */}
      <View style={styles.masterRow}>
        <View style={styles.masterInfo}>
          <MaterialCommunityIcons
            name="atom"
            size={24}
            color={settings.isGloballyEnabled ? theme.colors.primary : theme.colors.outline}
          />
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
              Hábitos Atómicos y Safe-to-Spend
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Convierte metas mensuales en disponible diario y micro-decisiones.
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

          {/* Opciones Avanzadas */}
          <List.Item
            title="Ponderar Fin de Semana (1.5x)"
            description="Asigna mayor cuota de viernes a domingo reduciendo lunes a jueves"
            left={(props) => <List.Icon {...props} icon="calendar-weekend" />}
            right={() => (
              <Switch
                value={settings.weekendWeightEnabled}
                onValueChange={setWeekendWeightEnabled}
                color={theme.colors.primary}
              />
            )}
          />

          <List.Item
            title="Notificaciones Interactivas"
            description="Recordatorios sutiles con botones de registro en 1 toque"
            left={(props) => <List.Icon {...props} icon="bell-ring-outline" />}
            right={() => (
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                color={theme.colors.primary}
              />
            )}
          />

          <List.Item
            title="Micro-Sweep (Barrido de Ahorro)"
            description="Sugerir mover remanentes diarios no gastados a metas de ahorro"
            left={(props) => <List.Icon {...props} icon="piggy-bank-outline" />}
            right={() => (
              <Switch
                value={settings.microSweepEnabled}
                onValueChange={setMicroSweepEnabled}
                color={theme.colors.primary}
              />
            )}
          />

          {/* Control Granular por Categoría */}
          {categories.length > 0 && (
            <>
              <Divider style={styles.divider} />
              <Text variant="titleSmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Activación Granular por Categoría
              </Text>
              {categories.map((cat) => {
                const active = isCategoryActive(cat.id);
                return (
                  <View key={cat.id} style={styles.categoryRow}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
                      {cat.name}
                    </Text>
                    <Switch
                      value={active}
                      onValueChange={(val) => setCategoryEnabled(cat.id, val)}
                      color={theme.colors.primary}
                    />
                  </View>
                );
              })}
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
  textContainer: {
    flex: 1,
  },
  divider: {
    marginVertical: 12,
  },
  sectionSubtitle: {
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
