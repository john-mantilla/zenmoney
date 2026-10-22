import { describe, it, expect } from 'vitest';
import {
  formatCompactCurrency,
  calculateChartScale,
} from '../../domain/utils/financialMath';

describe('CashFlowForecastChart helpers', () => {
  describe('formatCompactCurrency', () => {
    it('formatea millones con sufijo M', () => {
      expect(formatCompactCurrency(5_000_000)).toBe('$5M');
      expect(formatCompactCurrency(5_600_000)).toBe('$5.6M');
      expect(formatCompactCurrency(-11_800_000)).toBe('-$11.8M');
    });

    it('formatea miles con sufijo K', () => {
      expect(formatCompactCurrency(500_000)).toBe('$500K');
      expect(formatCompactCurrency(-250_000)).toBe('-$250K');
    });

    it('formatea cero y valores pequeños sin sufijo', () => {
      expect(formatCompactCurrency(0)).toBe('$0');
      expect(formatCompactCurrency(450)).toBe('$450');
      expect(formatCompactCurrency(-30)).toBe('-$30');
    });
  });

  describe('calculateChartScale', () => {
    it('resuelve el caso reportado por el usuario con valores negativos profundos', () => {
      // Datos reales del usuario: saldo positivo hasta 5.6M y caída hasta -11.8M
      const scale = calculateChartScale(-11_800_000, 5_600_000);

      // No debe generar 30+ secciones
      expect(scale.totalSections).toBeLessThanOrEqual(6);
      expect(scale.noOfSectionsBelowXAxis).toBeGreaterThan(0);
      expect(scale.noOfSections).toBeGreaterThan(0);

      // El rango debe cubrir el mínimo y máximo
      expect(scale.maxValue).toBeGreaterThanOrEqual(5_600_000);
      expect(scale.stepValue * scale.noOfSectionsBelowXAxis).toBeGreaterThanOrEqual(11_800_000);

      // La altura total debe mantenerse proporcional (~220px)
      const totalHeight = scale.stepHeight * scale.totalSections;
      expect(totalHeight).toBeGreaterThanOrEqual(200);
      expect(totalHeight).toBeLessThanOrEqual(260);
    });

    it('maneja proyecciones puramente positivas', () => {
      const scale = calculateChartScale(0, 4_000_000);
      expect(scale.noOfSectionsBelowXAxis).toBe(0);
      expect(scale.noOfSections).toBeGreaterThanOrEqual(1);
      expect(scale.maxValue).toBeGreaterThanOrEqual(4_000_000);
    });

    it('maneja proyecciones puramente deficitarias (negativas)', () => {
      const scale = calculateChartScale(-5_000_000, 0);
      expect(scale.noOfSectionsBelowXAxis).toBeGreaterThanOrEqual(1);
      expect(scale.noOfSections).toBe(1); // Mantiene cuadrante positivo mínimo para ver la línea 0
      expect(scale.stepValue * scale.noOfSectionsBelowXAxis).toBeGreaterThanOrEqual(5_000_000);
    });
  });
});
