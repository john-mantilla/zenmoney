import { describe, it, expect } from 'vitest';
import { Transaction, TransactionType, InputMethod } from '../../entities/Transaction';

describe('Transaction Entity', () => {
  it('debe validar la estructura completa de una transacción válida', () => {
    const tx: Transaction = {
      id: 'tx-123',
      familyGroupId: 'fam-1',
      accountId: 'acc-1',
      categoryId: 'cat-groceries',
      createdByUserId: 'usr-1',
      type: 'expense',
      amount: 150.5,
      currency: 'USD',
      description: 'Compra supermercado',
      merchantName: 'Éxito',
      transactionDate: '2026-07-28',
      transferToAccountId: null,
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'manual',
      aiMetadata: null,
      isPrivate: false,
      createdAt: '2026-07-28T10:00:00Z',
      updatedAt: '2026-07-28T10:00:00Z',
      syncedAt: null,
    };

    expect(tx.id).toBe('tx-123');
    expect(tx.amount).toBeGreaterThan(0);
    expect(tx.type).toBe('expense');
    expect(tx.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('debe soportar transacciones de tipo transferencia entre dos cuentas', () => {
    const transferTx: Transaction = {
      id: 'tx-456',
      familyGroupId: 'fam-1',
      accountId: 'acc-bank',
      categoryId: null,
      createdByUserId: 'usr-1',
      type: 'transfer',
      amount: 500,
      currency: 'USD',
      description: 'Traspaso a cuenta de ahorro',
      merchantName: null,
      transactionDate: '2026-07-28',
      transferToAccountId: 'acc-savings',
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'manual',
      aiMetadata: null,
      isPrivate: false,
      createdAt: '2026-07-28T10:00:00Z',
      updatedAt: '2026-07-28T10:00:00Z',
      syncedAt: null,
    };

    expect(transferTx.type).toBe('transfer');
    expect(transferTx.transferToAccountId).toBe('acc-savings');
    expect(transferTx.categoryId).toBeNull();
  });

  it('debe registrar metadatos de IA si fue procesada por NLP/Voz', () => {
    const aiTx: Transaction = {
      id: 'tx-789',
      familyGroupId: 'fam-1',
      accountId: 'acc-cash',
      categoryId: 'cat-food',
      createdByUserId: 'usr-1',
      type: 'expense',
      amount: 25,
      currency: 'USD',
      description: 'Almuerzo',
      merchantName: 'Restaurante ABC',
      transactionDate: '2026-07-28',
      transferToAccountId: null,
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'voice',
      aiMetadata: {
        rawInput: 'Gaste 25 dolares en almuerzo hoy',
        parsedAmount: 25,
        parsedCategory: 'Alimentos',
        parsedAccount: 'Efectivo',
        parsedMerchant: 'Restaurante ABC',
        confidence: 0.95,
        corrections: {},
      },
      isPrivate: false,
      createdAt: '2026-07-28T10:00:00Z',
      updatedAt: '2026-07-28T10:00:00Z',
      syncedAt: null,
    };

    expect(aiTx.inputMethod).toBe('voice');
    expect(aiTx.aiMetadata?.confidence).toBe(0.95);
    expect(aiTx.aiMetadata?.rawInput).toBe('Gaste 25 dolares en almuerzo hoy');
  });
});
