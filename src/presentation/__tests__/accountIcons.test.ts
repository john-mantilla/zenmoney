import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_ICONS_CATALOG,
  ACCOUNT_ICONS_MAP,
  isCatalogIcon,
  getCatalogIcon,
} from '../theme/accountIcons';
import { inferAccountBrand } from '../theme/accountBrands';

describe('Account Icons Catalog', () => {
  it('contiene los 8 íconos esenciales requeridos', () => {
    const ids = ACCOUNT_ICONS_CATALOG.map((i) => i.id);
    expect(ids).toContain('visa');
    expect(ids).toContain('mastercard');
    expect(ids).toContain('amex');
    expect(ids).toContain('bank');
    expect(ids).toContain('cash');
    expect(ids).toContain('checkbook');
    expect(ids).toContain('dollar');
    expect(ids).toContain('crypto');
  });

  it('valida correctamente claves pertenecientes al catálogo', () => {
    expect(isCatalogIcon('visa')).toBe(true);
    expect(isCatalogIcon('VISA')).toBe(true);
    expect(isCatalogIcon('amex')).toBe(true);
    expect(isCatalogIcon('mastercard')).toBe(true);
    expect(isCatalogIcon('checkbook')).toBe(true);
    expect(isCatalogIcon('desconocido')).toBe(false);
    expect(isCatalogIcon(null)).toBe(false);
    expect(isCatalogIcon(undefined)).toBe(false);
  });

  it('obtiene la definición completa del ícono', () => {
    const visa = getCatalogIcon('visa');
    expect(visa).toBeDefined();
    expect(visa?.label).toBe('Visa');
    expect(visa?.category).toBe('card');

    const cash = getCatalogIcon('cash');
    expect(cash).toBeDefined();
    expect(cash?.label).toBe('Efectivo');
  });
});

describe('Inferencia Automática de Marcas e Iconos', () => {
  it('infiere Visa a partir del nombre', () => {
    const brand = inferAccountBrand('Tarjeta Crédito Visa Signature', 'credit_card');
    expect(brand.icon).toBe('visa');
    expect(brand.isBrandMatch).toBe(true);
  });

  it('infiere MasterCard a partir del nombre', () => {
    const brand = inferAccountBrand('MasterCard Black', 'credit_card');
    expect(brand.icon).toBe('mastercard');
    expect(brand.isBrandMatch).toBe(true);
  });

  it('infiere Amex a partir del nombre', () => {
    const brand = inferAccountBrand('Amex Platino Bancolombia', 'credit_card');
    expect(brand.icon).toBe('amex');
    expect(brand.isBrandMatch).toBe(true);
  });

  it('infiere Chequera a partir del nombre', () => {
    const brand = inferAccountBrand('Chequera Comercial', 'bank');
    expect(brand.icon).toBe('checkbook');
    expect(brand.isBrandMatch).toBe(true);
  });

  it('infiere Dólar a partir del nombre', () => {
    const brand = inferAccountBrand('Cuenta Dolar Ahorros USD', 'bank');
    expect(brand.icon).toBe('dollar');
    expect(brand.isBrandMatch).toBe(true);
  });

  it('infiere Efectivo para nombres de caja o efectivo', () => {
    const brand = inferAccountBrand('Bolsillo Efectivo Casa', 'cash');
    expect(brand.icon).toBe('cash');
    expect(brand.isBrandMatch).toBe(true);
  });
});
