/**
 * ZenMoney — Account Customization Store (Zustand)
 *
 * Almacena los colores e íconos personalizados elegidos por el usuario por id de cuenta,
 * permitiendo personalización 100% persistente y sin errores de columna en Supabase.
 */
import { create } from 'zustand';

interface AccountCustomizationState {
  customColors: Record<string, string>;
  customIcons: Record<string, string>;
  setCustomColor: (accountId: string, color: string) => void;
  setCustomIcon: (accountId: string, icon: string) => void;
}

export const useAccountCustomizationStore = create<AccountCustomizationState>((set) => ({
  customColors: {},
  customIcons: {},
  setCustomColor: (accountId, color) =>
    set((state) => ({
      customColors: { ...state.customColors, [accountId]: color },
    })),
  setCustomIcon: (accountId, icon) =>
    set((state) => ({
      customIcons: { ...state.customIcons, [accountId]: icon },
    })),
}));
