import { describe, it, expect } from 'vitest';
import { SavingsGoal } from '../../entities/SavingsGoal';

describe('SavingsGoal Entity', () => {
  it('debe validar la estructura de una meta de ahorro activa', () => {
    const goal: SavingsGoal = {
      id: 'sg-1',
      familyGroupId: 'fam-1',
      ownerUserId: 'usr-1',
      name: 'Fondo de Emergencia',
      targetAmount: 5000,
      currentAmount: 2000,
      targetDate: '2026-12-31',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(goal.name).toBe('Fondo de Emergencia');
    expect(goal.targetAmount).toBe(5000);
    expect(goal.currentAmount).toBe(2000);
    expect(goal.status).toBe('active');
  });

  it('debe representar una meta completada cuando el monto actual iguala o supera la meta', () => {
    const goal: SavingsGoal = {
      id: 'sg-2',
      familyGroupId: 'fam-1',
      ownerUserId: 'usr-1',
      name: 'Viaje Vacaciones',
      targetAmount: 1500,
      currentAmount: 1500,
      targetDate: '2026-07-01',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(goal.status).toBe('completed');
    expect(goal.currentAmount).toBeGreaterThanOrEqual(goal.targetAmount);
  });
});
