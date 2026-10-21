import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountCustomizationStore } from '../state/accountCustomizationStore';

describe('accountCustomizationStore', () => {
  beforeEach(() => {
    useAccountCustomizationStore.setState({
      customColors: {},
      customIcons: {},
    });
  });

  it('guarda y recupera íconos personalizados por accountId', () => {
    const store = useAccountCustomizationStore.getState();
    store.setCustomIcon('acc-1', 'amex');

    const updated = useAccountCustomizationStore.getState();
    expect(updated.customIcons['acc-1']).toBe('amex');
  });

  it('guarda y recupera colores personalizados por accountId', () => {
    const store = useAccountCustomizationStore.getState();
    store.setCustomColor('acc-1', '#006FCF');

    const updated = useAccountCustomizationStore.getState();
    expect(updated.customColors['acc-1']).toBe('#006FCF');
  });

  it('permite reiniciar/eliminar personalización de una cuenta', () => {
    const store = useAccountCustomizationStore.getState();
    store.setCustomIcon('acc-1', 'amex');
    store.setCustomColor('acc-1', '#006FCF');

    store.resetCustomization('acc-1');

    const updated = useAccountCustomizationStore.getState();
    expect(updated.customIcons['acc-1']).toBeUndefined();
    expect(updated.customColors['acc-1']).toBeUndefined();
  });
});
