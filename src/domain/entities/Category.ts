/**
 * ZenMoney — Entidad Category
 */

import { BudgetRole } from './FinancialMethodology';

export interface Category {
  id: string;
  familyGroupId: string | null; // null si es de sistema (compartida)
  name: string;
  icon: string;
  color: string;
  parentCategoryId: string | null; // Null si es categoría principal, uuid si es subcategoría
  budgetRole: BudgetRole;
  isSystem: boolean;
  isPrivate: boolean;
  createdAt: string;
}

export interface CreateCategoryInput {
  id?: string;
  name: string;
  icon: string;
  color: string;
  parentCategoryId?: string | null;
  budgetRole?: BudgetRole;
  isPrivate?: boolean;
}

export function inferCategoryBudgetRole(name: string, parentName?: string, explicitRole?: BudgetRole): BudgetRole {
  if (explicitRole) {
    return explicitRole;
  }

  const fullName = `${name} ${parentName || ''}`.toLowerCase();

  // 1. Deseos & Estilo de Vida (wants)
  if (
    fullName.includes('entretenimiento') ||
    fullName.includes('ocio') ||
    fullName.includes('restaurante') ||
    fullName.includes('comida fuera') ||
    fullName.includes('compras') ||
    fullName.includes('viaje') ||
    fullName.includes('vacaciones') ||
    fullName.includes('gusto') ||
    fullName.includes('salida') ||
    fullName.includes('cine') ||
    fullName.includes('bar') ||
    fullName.includes('suscrip') ||
    fullName.includes('hobby') ||
    fullName.includes('hobbies') ||
    fullName.includes('ropa') ||
    fullName.includes('calzado') ||
    fullName.includes('estética') ||
    fullName.includes('belleza') ||
    fullName.includes('tecnología') ||
    fullName.includes('regalo')
  ) {
    return 'wants';
  }

  // 2. Ahorros, Inversiones & Deudas (savings)
  if (
    fullName.includes('ahorro') ||
    fullName.includes('invers') ||
    fullName.includes('meta') ||
    fullName.includes('cdt') ||
    fullName.includes('fiduciaria') ||
    fullName.includes('deuda') ||
    fullName.includes('hipoteca') ||
    fullName.includes('seguro') ||
    fullName.includes('fondo') ||
    fullName.includes('pensión') ||
    fullName.includes('crédito') ||
    fullName.includes('prestamo')
  ) {
    return 'savings';
  }

  // 3. Caridad (charity)
  if (fullName.includes('caridad') || fullName.includes('donaci') || fullName.includes('diezmo')) {
    return 'charity';
  }

  // 4. Ingresos (income)
  if (
    fullName.includes('ingreso') ||
    fullName.includes('sueldo') ||
    fullName.includes('salario') ||
    fullName.includes('honorario') ||
    fullName.includes('venta') ||
    fullName.includes('dividend')
  ) {
    return 'income';
  }

  return explicitRole || 'needs';
}
