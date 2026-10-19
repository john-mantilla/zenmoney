import { describe, it, expect, beforeEach } from 'vitest';
import { useHabitSettingsStore, defaultHabitSettings } from '../state/habitSettingsStore';

describe('useHabitSettingsStore', () => {
  beforeEach(() => {
    useHabitSettingsStore.getState().resetDefaults();
  });

  it('inicia con la configuración por defecto', () => {
    const { settings } = useHabitSettingsStore.getState();
    expect(settings.isGloballyEnabled).toBe(true);
    expect(settings.notificationsEnabled).toBe(true);
    expect(settings.weekendWeightEnabled).toBe(true);
    expect(settings.weekendWeightRatio).toBe(1.5);
    expect(settings.microSweepEnabled).toBe(false);
  });

  it('permite desactivar globalmente la funcionalidad', () => {
    useHabitSettingsStore.getState().setGloballyEnabled(false);
    expect(useHabitSettingsStore.getState().settings.isGloballyEnabled).toBe(false);
    // Ninguna categoría debería estar activa si está deshabilitado globalmente
    expect(useHabitSettingsStore.getState().isCategoryActive('cat-restaurants')).toBe(false);
  });

  it('permite deshabilitar y habilitar una categoría específica (granular toggle)', () => {
    const store = useHabitSettingsStore.getState();

    // Por defecto activa
    expect(store.isCategoryActive('cat-groceries')).toBe(true);

    // Desactivar categoría específica
    store.setCategoryEnabled('cat-groceries', false);
    expect(useHabitSettingsStore.getState().isCategoryActive('cat-groceries')).toBe(false);

    // Otra categoría no afectada sigue activa
    expect(useHabitSettingsStore.getState().isCategoryActive('cat-restaurants')).toBe(true);

    // Reactivar
    useHabitSettingsStore.getState().setCategoryEnabled('cat-groceries', true);
    expect(useHabitSettingsStore.getState().isCategoryActive('cat-groceries')).toBe(true);
  });

  it('permite ajustar el ratio de fin de semana con valor mínimo de 1.0', () => {
    useHabitSettingsStore.getState().setWeekendWeightRatio(2.0);
    expect(useHabitSettingsStore.getState().settings.weekendWeightRatio).toBe(2.0);

    // No permite valores menores a 1.0
    useHabitSettingsStore.getState().setWeekendWeightRatio(0.5);
    expect(useHabitSettingsStore.getState().settings.weekendWeightRatio).toBe(1.0);
  });
});
