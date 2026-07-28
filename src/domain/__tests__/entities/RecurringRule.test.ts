import { describe, it, expect } from 'vitest';
import { RecurringRule, Frequency } from '../../entities/RecurringRule';

describe('RecurringRule Entity', () => {
  it('debe validar la estructura de una regla de pago recurrente mensual', () => {
    const rule: RecurringRule = {
      id: 'rec-1',
      familyGroupId: 'fam-1',
      accountId: 'acc-bank',
      categoryId: 'cat-rent',
      type: 'expense',
      amount: 800,
      description: 'Arriendo departamento',
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-01-05',
      endDate: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(rule.id).toBe('rec-1');
    expect(rule.frequency).toBe('monthly');
    expect(rule.dayOfMonth).toBe(5);
    expect(rule.amount).toBe(800);
    expect(rule.isActive).toBe(true);
  });

  it('debe admitir reglas con fecha de término definida', () => {
    const termRule: RecurringRule = {
      id: 'rec-2',
      familyGroupId: 'fam-1',
      accountId: 'acc-card',
      categoryId: 'cat-subscription',
      type: 'expense',
      amount: 15,
      description: 'Suscripción Gimnasio',
      frequency: 'monthly',
      dayOfMonth: 1,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(termRule.endDate).toBe('2026-12-31');
  });
});
