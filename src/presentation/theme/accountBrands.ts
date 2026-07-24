/**
 * ZenMoney — Mapeador Inteligente de Marcas Financieras & Colores Oficiales
 *
 * Mapea automáticamente el color oficial de la marca (Bancolombia, Nequi, Nu, Davivienda, Bold, etc.)
 * y asigna el ícono representativo según el Tipo de Cuenta (Banco, Efectivo, Tarjeta, Crédito, Inversión).
 */

import { Account, AccountType } from '@/src/domain/entities/Account';

export interface AccountBrandInfo {
  color: string;
  icon: string;
  isBrandMatch: boolean;
}

export const BRAND_COLORS = [
  { label: 'Negro Bancolombia', color: '#2C2A29' },
  { label: 'Fucsia Nequi', color: '#E91E63' },
  { label: 'Púrpura Nu', color: '#8A05BE' },
  { label: 'Rojo Davivienda', color: '#E53935' },
  { label: 'Azul Bold', color: '#1A237E' },
  { label: 'Naranja Rappi', color: '#FF5722' },
  { label: 'Verde Lulo', color: '#84CC16' },
  { label: 'Azul Mercado Pago', color: '#0284C7' },
  { label: 'Verde Falabella', color: '#65A30D' },
  { label: 'Verde Efectivo', color: '#2E7D32' },
];

/**
 * Retorna el ícono por defecto según los 5 tipos de cuenta básicos
 */
export function getTypeIcon(type: AccountType): string {
  switch (type) {
    case 'bank': return 'bank';
    case 'cash': return 'cash-multiple';
    case 'credit_card': return 'credit-card';
    case 'loan': return 'bank-transfer-out';
    case 'investment': return 'chart-line';
    default: return 'bank';
  }
}

/**
 * Infiere el color de marca oficial según el nombre e ícono según el tipo de cuenta
 */
export function inferAccountBrand(name: string, type: AccountType): AccountBrandInfo {
  const n = (name || '').toLowerCase().trim();
  const icon = getTypeIcon(type);

  // 1. Bancolombia / Wompi -> #2C2A29 (Negro carbón oficial)
  if (n.includes('bancolombia') || n.includes('wompi')) {
    return { color: '#2C2A29', icon, isBrandMatch: true };
  }

  // 2. Nequi -> #E91E63 (Fucsia Nequi)
  if (n.includes('nequi')) {
    return { color: '#E91E63', icon, isBrandMatch: true };
  }

  // 3. Nu / NuBank -> #8A05BE
  if (n.includes('nu') || n.includes('nubank')) {
    return { color: '#8A05BE', icon: type === 'bank' ? 'credit-card' : icon, isBrandMatch: true };
  }

  // 4. Davivienda / Daviplata -> #E53935
  if (n.includes('davivienda') || n.includes('daviplata')) {
    return { color: '#E53935', icon, isBrandMatch: true };
  }

  // 5. Bold -> #1A237E
  if (n.includes('bold')) {
    return { color: '#1A237E', icon, isBrandMatch: true };
  }

  // 6. Rappi / RappiPay -> #FF5722
  if (n.includes('rappi')) {
    return { color: '#FF5722', icon, isBrandMatch: true };
  }

  // 7. BBVA -> #004481
  if (n.includes('bbva')) {
    return { color: '#004481', icon, isBrandMatch: true };
  }

  // 8. Lulo / LuloBank -> #84CC16
  if (n.includes('lulo')) {
    return { color: '#84CC16', icon, isBrandMatch: true };
  }

  // 9. Mercado Pago -> #0284C7
  if (n.includes('mercado') || n.includes('mp')) {
    return { color: '#0284C7', icon, isBrandMatch: true };
  }

  // 10. Falabella / CMR -> #65A30D
  if (n.includes('falabella') || n.includes('cmr')) {
    return { color: '#65A30D', icon: type === 'bank' ? 'credit-card' : icon, isBrandMatch: true };
  }

  // 11. Efectivo
  if (n.includes('efectivo') || n.includes('cash') || type === 'cash') {
    return { color: '#2E7D32', icon: 'cash-multiple', isBrandMatch: true };
  }

  // Fallback por tipo básico
  if (type === 'credit_card') return { color: '#475569', icon, isBrandMatch: false };
  if (type === 'investment') return { color: '#0D9488', icon, isBrandMatch: false };
  if (type === 'loan') return { color: '#D97706', icon, isBrandMatch: false };

  return { color: '#2563EB', icon, isBrandMatch: false };
}

import { useAccountCustomizationStore } from '@/src/infrastructure/state/accountCustomizationStore';

/**
 * Obtiene la información completa de color e ícono para una cuenta
 */
export function getAccountBrandInfo(account: Partial<Account>): AccountBrandInfo {
  const name = account.name || '';
  const type = account.type || 'bank';

  const inferred = inferAccountBrand(name, type);

  let customColor: string | undefined = account.color;
  let customIcon: string | undefined = account.icon;

  if (account.id) {
    try {
      const state = useAccountCustomizationStore.getState();
      if (state.customColors[account.id]) customColor = state.customColors[account.id];
      if (state.customIcons[account.id]) customIcon = state.customIcons[account.id];
    } catch {
      // Fallback
    }
  }

  let icon = customIcon || inferred.icon;

  return {
    color: customColor || inferred.color,
    icon,
    isBrandMatch: inferred.isBrandMatch,
  };
}
