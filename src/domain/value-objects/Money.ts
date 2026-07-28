/**
 * ZenMoney — Value Object: Money
 * Representación inmutable de un monto monetario con divisa y operaciones aritméticas seguras.
 */

export class Money {
  public readonly amount: number;
  public readonly currency: string;

  constructor(amount: number, currency: string = 'USD') {
    // Redondear a 2 decimales para evitar imprecisiones de punto flotante en JS
    this.amount = Math.round((amount + Number.EPSILON) * 100) / 100;
    this.currency = currency.toUpperCase();
  }

  static from(amount: number, currency: string = 'USD'): Money {
    return new Money(amount, currency);
  }

  static zero(currency: string = 'USD'): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  format(locale: string = 'es-CO'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(this.amount);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`No se pueden operar divisas distintas: ${this.currency} y ${other.currency}`);
    }
  }
}
