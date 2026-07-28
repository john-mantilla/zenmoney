import { describe, it, expect } from 'vitest';
import { Money } from '../../value-objects/Money';

describe('Money Value Object', () => {
  it('debe instanciar correctamente un objeto Money y redondear a 2 decimales', () => {
    const m = new Money(100.556, 'USD');
    expect(m.amount).toBe(100.56);
    expect(m.currency).toBe('USD');
  });

  it('debe permitir crear Money con el método estático from y zero', () => {
    const m1 = Money.from(50, 'COP');
    const m2 = Money.zero('COP');

    expect(m1.amount).toBe(50);
    expect(m1.currency).toBe('COP');
    expect(m2.amount).toBe(0);
    expect(m2.currency).toBe('COP');
  });

  it('debe sumar dos montos de la misma divisa', () => {
    const m1 = Money.from(10.25, 'USD');
    const m2 = Money.from(5.75, 'USD');
    const result = m1.add(m2);

    expect(result.amount).toBe(16.0);
    expect(result.currency).toBe('USD');
  });

  it('debe restar dos montos de la misma divisa', () => {
    const m1 = Money.from(20, 'USD');
    const m2 = Money.from(8.5, 'USD');
    const result = m1.subtract(m2);

    expect(result.amount).toBe(11.5);
  });

  it('debe multiplicar el monto por un factor', () => {
    const m = Money.from(15, 'USD');
    const result = m.multiply(3);

    expect(result.amount).toBe(45);
  });

  it('debe lanzar error al operar distintas divisas', () => {
    const usd = Money.from(10, 'USD');
    const cop = Money.from(40000, 'COP');

    expect(() => usd.add(cop)).toThrow('No se pueden operar divisas distintas: USD y COP');
    expect(() => usd.subtract(cop)).toThrow('No se pueden operar divisas distintas: USD y COP');
  });

  it('debe verificar igualdad entre objetos Money', () => {
    const m1 = Money.from(100, 'USD');
    const m2 = Money.from(100, 'USD');
    const m3 = Money.from(200, 'USD');
    const m4 = Money.from(100, 'EUR');

    expect(m1.equals(m2)).toBe(true);
    expect(m1.equals(m3)).toBe(false);
    expect(m1.equals(m4)).toBe(false);
  });

  it('debe evaluar correctamente isPositive, isNegative e isZero', () => {
    expect(Money.from(10).isPositive()).toBe(true);
    expect(Money.from(-5).isNegative()).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
  });

  it('debe formatear el monto usando Intl', () => {
    const m = Money.from(1500, 'USD');
    const formatted = m.format('en-US');
    expect(formatted).toContain('1,500');
  });
});
