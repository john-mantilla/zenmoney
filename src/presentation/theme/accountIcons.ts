/**
 * ZenMoney — Catálogo de Iconos Embebidos de Cuentas Financieras
 *
 * Catálogo visual cerrado de alta fidelidad que incluye marcas de pago,
 * tipos de entidad y divisas (Amex, Visa, MasterCard, Bancos, Efectivo, etc.).
 */

import VisaImg from '../../../assets/images/accounts/Visa.png';
import MasterCardImg from '../../../assets/images/accounts/MasterCard.png';
import AmexImg from '../../../assets/images/accounts/Amex.png';
import BankImg from '../../../assets/images/accounts/Bank.png';
import CashImg from '../../../assets/images/accounts/Cash.png';
import CheckBookImg from '../../../assets/images/accounts/CheckBook.png';
import DollarImg from '../../../assets/images/accounts/Dollar.png';
import CryptoImg from '../../../assets/images/accounts/Crypto.png';

export type AccountIconKey =
  | 'amex'
  | 'bank'
  | 'cash'
  | 'checkbook'
  | 'crypto'
  | 'dollar'
  | 'mastercard'
  | 'visa';

export type AccountIconCategory = 'all' | 'card' | 'bank' | 'cash' | 'other';

export interface AccountIconDefinition {
  id: AccountIconKey;
  label: string;
  source: any;
  category: 'card' | 'bank' | 'cash' | 'other';
  defaultColor: string;
}

export const ACCOUNT_ICONS_CATALOG: AccountIconDefinition[] = [
  {
    id: 'visa',
    label: 'Visa',
    source: VisaImg,
    category: 'card',
    defaultColor: '#1A1F71',
  },
  {
    id: 'mastercard',
    label: 'MasterCard',
    source: MasterCardImg,
    category: 'card',
    defaultColor: '#1A202C',
  },
  {
    id: 'amex',
    label: 'Amex',
    source: AmexImg,
    category: 'card',
    defaultColor: '#006FCF',
  },
  {
    id: 'bank',
    label: 'Banco',
    source: BankImg,
    category: 'bank',
    defaultColor: '#1E3A8A',
  },
  {
    id: 'cash',
    label: 'Efectivo',
    source: CashImg,
    category: 'cash',
    defaultColor: '#059669',
  },
  {
    id: 'checkbook',
    label: 'Chequera',
    source: CheckBookImg,
    category: 'bank',
    defaultColor: '#0F766E',
  },
  {
    id: 'dollar',
    label: 'Dólar',
    source: DollarImg,
    category: 'cash',
    defaultColor: '#10B981',
  },
  {
    id: 'crypto',
    label: 'Cripto',
    source: CryptoImg,
    category: 'other',
    defaultColor: '#F97316',
  },
];

export const ACCOUNT_ICONS_MAP: Record<string, AccountIconDefinition> = {
  amex: ACCOUNT_ICONS_CATALOG[2],
  bank: ACCOUNT_ICONS_CATALOG[3],
  cash: ACCOUNT_ICONS_CATALOG[4],
  checkbook: ACCOUNT_ICONS_CATALOG[5],
  crypto: ACCOUNT_ICONS_CATALOG[7],
  dollar: ACCOUNT_ICONS_CATALOG[6],
  mastercard: ACCOUNT_ICONS_CATALOG[1],
  visa: ACCOUNT_ICONS_CATALOG[0],
};

/**
 * Retorna true si la clave proporcionada corresponde a un asset gráfico del catálogo embebido
 */
export function isCatalogIcon(iconKey?: string | null): boolean {
  if (!iconKey) return false;
  const normalized = iconKey.toLowerCase().trim();
  return Boolean(ACCOUNT_ICONS_MAP[normalized]);
}

/**
 * Obtiene la definición del ícono en el catálogo, o undefined si no existe
 */
export function getCatalogIcon(iconKey?: string | null): AccountIconDefinition | undefined {
  if (!iconKey) return undefined;
  const normalized = iconKey.toLowerCase().trim();
  return ACCOUNT_ICONS_MAP[normalized];
}
