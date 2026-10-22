import { describe, it, expect } from 'vitest';
import {
  annualEffectiveToMonthlyRate,
  normalizeMonthlyRate,
  calculateMonthlyInstallment,
  generateAmortizationSchedule,
} from '../../utils/financialMath';

describe('financialMath Utils', () => {
  describe('annualEffectiveToMonthlyRate', () => {
    it('convierte una tasa EA a periódica mensual correctamente', () => {
      // 26.824% EA -> (1 + 0.26824179)^(1/12) - 1 ≈ 0.02 (2.0% EM)
      const ea = 26.824179;
      const em = annualEffectiveToMonthlyRate(ea);
      expect(em).toBeCloseTo(0.02, 3);
    });

    it('retorna 0 si la tasa EA es <= 0', () => {
      expect(annualEffectiveToMonthlyRate(0)).toBe(0);
      expect(annualEffectiveToMonthlyRate(-5)).toBe(0);
    });
  });

  describe('normalizeMonthlyRate', () => {
    it('normaliza tasas expresadas en porcentaje o decimal', () => {
      expect(normalizeMonthlyRate(2.5)).toBe(0.025);
      expect(normalizeMonthlyRate(0.025)).toBe(0.025);
      expect(normalizeMonthlyRate(0)).toBe(0);
    });
  });

  describe('calculateMonthlyInstallment', () => {
    it('calcula la cuota mensual francesa para un crédito con interés', () => {
      // Crédito de 5.000.000 a 12 meses con tasa de 2% mensual (0.02)
      // Cuota teórica = 5000000 * (0.02 * (1.02)^12) / ((1.02)^12 - 1) ≈ 472.798
      const installment = calculateMonthlyInstallment(5000000, 0.02, 12);
      expect(installment).toBe(472798);
    });

    it('calcula cuota plana si la tasa de interés es 0% (promoción sin interés)', () => {
      const installment = calculateMonthlyInstallment(1200000, 0, 6);
      expect(installment).toBe(200000);
    });

    it('retorna 0 ante monto o plazo inválido', () => {
      expect(calculateMonthlyInstallment(0, 0.02, 12)).toBe(0);
      expect(calculateMonthlyInstallment(1000000, 0.02, 0)).toBe(0);
    });
  });

  describe('generateAmortizationSchedule', () => {
    it('genera el cronograma completo de amortización y reduce el saldo a 0', () => {
      const summary = generateAmortizationSchedule(1000000, 0.02, 6, '2026-10-01');

      expect(summary.principal).toBe(1000000);
      expect(summary.months).toBe(6);
      expect(summary.schedule.length).toBe(6);

      // Verificamos que el saldo final sea 0
      const lastRow = summary.schedule[5];
      expect(lastRow.remainingBalance).toBe(0);

      // La suma de abonos a capital debe coincidir exactamente con el principal
      const totalCapital = summary.schedule.reduce((sum, r) => sum + r.principalPayment, 0);
      expect(totalCapital).toBe(1000000);

      // El total pagado debe ser principal + totalInterest
      expect(summary.totalPaid).toBe(summary.principal + summary.totalInterest);
    });

    it('funciona correctamente para compras a cuotas con 0% de interés', () => {
      const summary = generateAmortizationSchedule(600000, 0, 3, '2026-11-01');
      expect(summary.totalInterest).toBe(0);
      expect(summary.totalPaid).toBe(600000);
      expect(summary.monthlyInstallment).toBe(200000);
      expect(summary.schedule[0].installment).toBe(200000);
      expect(summary.schedule[0].interest).toBe(0);
      expect(summary.schedule[2].remainingBalance).toBe(0);
    });
  });
});
