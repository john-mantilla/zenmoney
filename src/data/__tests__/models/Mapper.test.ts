import { describe, it, expect } from 'vitest';
import { Mapper } from '../../models/Mapper';
import { Transaction } from '../../../domain/entities/Transaction';
import { Account } from '../../../domain/entities/Account';
import { Budget } from '../../../domain/entities/Budget';
import { SavingsGoal } from '../../../domain/entities/SavingsGoal';
import { RecurringRule } from '../../../domain/entities/RecurringRule';
import { Category } from '../../../domain/entities/Category';
import { CategorizationRule } from '../../../domain/entities/CategorizationRule';

describe('Mapper — Pruebas de Integración Bidireccional (DB snake_case ↔ Domain camelCase)', () => {

  describe('User Profile & Family Group Mapping', () => {
    it('mapea fila de user_profiles a UserProfile de dominio', () => {
      const dbRow = {
        id: 'usr-1',
        auth_user_id: 'auth-1',
        family_group_id: 'fam-1',
        display_name: 'Juan Perez',
        email: 'juan@example.com',
        role: 'admin',
        created_at: '2026-01-01T00:00:00Z',
      };
      const user = Mapper.toDomainUserProfile(dbRow);
      expect(user.displayName).toBe('Juan Perez');
      expect(user.role).toBe('admin');
    });

    it('mapea fila de family_groups a FamilyGroup de dominio', () => {
      const dbRow = {
        id: 'fam-1',
        name: 'Familia Perez',
        currency_default: 'USD',
        inbound_token: 'tok-123',
        created_at: '2026-01-01T00:00:00Z',
      };
      const family = Mapper.toDomainFamilyGroup(dbRow);
      expect(family.name).toBe('Familia Perez');
      expect(family.currencyDefault).toBe('USD');
    });
  });

  describe('Transaction Mapping', () => {
    it('mapea correctamente una fila de DB (snake_case) a entidad Transaction de Dominio (camelCase)', () => {
      const dbRow = {
        id: 'tx-100',
        family_group_id: 'fam-1',
        account_id: 'acc-1',
        category_id: 'cat-groceries',
        created_by_user_id: 'usr-1',
        type: 'expense',
        amount: '125.50',
        currency: 'USD',
        description: 'Compra en Supermercado',
        merchant_name: 'Éxito',
        transaction_date: '2026-07-28',
        transfer_to_account_id: null,
        is_recurring_instance: true,
        recurring_rule_id: 'rule-55',
        status: 'confirmed',
        input_method: 'voice',
        is_private: false,
        created_at: '2026-07-28T10:00:00Z',
        updated_at: '2026-07-28T10:00:00Z',
        synced_at: null,
        ai_metadata: {
          raw_input: 'Gaste 125.5 dolares en Exito',
          parsed_amount: 125.5,
          parsed_category: 'Supermercado',
          parsed_account: null,
          parsed_merchant: 'Éxito',
          confidence: 0.95,
          corrections: {},
          due_date: '2026-07-28',
        },
      };

      const tx = Mapper.toDomainTransaction(dbRow);

      expect(tx.id).toBe('tx-100');
      expect(tx.familyGroupId).toBe('fam-1');
      expect(tx.amount).toBe(125.50);
      expect(tx.isRecurringInstance).toBe(true);
      expect(tx.recurringRuleId).toBe('rule-55');
      expect(tx.inputMethod).toBe('voice');
      expect(tx.aiMetadata?.rawInput).toBe('Gaste 125.5 dolares en Exito');
    });

    it('mapea correctamente una entidad Transaction de Dominio a formato DB', () => {
      const domainTx: Partial<Transaction> = {
        id: 'tx-200',
        familyGroupId: 'fam-1',
        accountId: 'acc-1',
        categoryId: 'cat-rent',
        createdByUserId: 'usr-1',
        type: 'expense',
        amount: 800,
        currency: 'USD',
        description: 'Pago arriendo',
        merchantName: 'Arrendador',
        transactionDate: '2026-07-05',
        transferToAccountId: null,
        isRecurringInstance: false,
        recurringRuleId: null,
        status: 'confirmed',
        inputMethod: 'manual',
        isPrivate: false,
        aiMetadata: {
          rawInput: 'Arriendo',
          parsedAmount: 800,
          parsedCategory: 'Vivienda',
          parsedAccount: null,
          parsedMerchant: null,
          confidence: 1,
          corrections: {},
          dueDate: '2026-07-05',
        },
      };

      const dbRow = Mapper.toDbTransaction(domainTx);

      expect(dbRow.id).toBe('tx-200');
      expect(dbRow.family_group_id).toBe('fam-1');
      expect(dbRow.amount).toBe(800);
      expect(dbRow.ai_metadata.raw_input).toBe('Arriendo');
    });
  });

  describe('Account Mapping', () => {
    it('mapea correctamente Account de DB a Dominio (incluyendo tipo mortgage -> loan)', () => {
      const dbAccount = {
        id: 'acc-mortgage-1',
        family_group_id: 'fam-1',
        owner_user_id: 'usr-1',
        name: 'Hipoteca Casa',
        type: 'mortgage',
        initial_balance: '150000.00',
        currency: 'USD',
        is_active: true,
        closing_day: '15',
        payment_day: '5',
        is_private: true,
        created_at: '2026-01-01T00:00:00Z',
      };

      const account = Mapper.toDomainAccount(dbAccount);

      expect(account.id).toBe('acc-mortgage-1');
      expect(account.type).toBe('loan');
      expect(account.initialBalance).toBe(150000);
      expect(account.closingDay).toBe(15);
      expect(account.paymentDay).toBe(5);
    });

    it('mapea correctamente Account de Dominio a DB', () => {
      const domainAcc: Partial<Account> = {
        id: 'acc-cash',
        familyGroupId: 'fam-1',
        ownerUserId: 'usr-1',
        name: 'Efectivo Bolsillo',
        type: 'cash',
        initialBalance: 250,
        currency: 'USD',
        isActive: true,
      };

      const dbRow = Mapper.toDbAccount(domainAcc);

      expect(dbRow.id).toBe('acc-cash');
      expect(dbRow.initial_balance).toBe(250);
    });
  });

  describe('Category Mapping', () => {
    it('mapea bidireccionalmente la entidad Category', () => {
      const dbCategory = {
        id: 'cat-1',
        family_group_id: 'fam-1',
        name: 'Mercado',
        icon: 'shopping-cart',
        color: '#FF0000',
        parent_category_id: null,
        is_system: false,
        is_private: false,
        created_at: '2026-01-01T00:00:00Z',
      };

      const cat = Mapper.toDomainCategory(dbCategory);
      expect(cat.name).toBe('Mercado');

      const dbRow = Mapper.toDbCategory(cat);
      expect(dbRow.name).toBe('Mercado');
      expect(dbRow.family_group_id).toBe('fam-1');
    });
  });

  describe('Budget Mapping', () => {
    it('mapea bidireccionalmente la entidad Budget', () => {
      const dbBudget = {
        id: 'bdg-1',
        family_group_id: 'fam-1',
        category_id: 'cat-food',
        amount_limit: '600.00',
        year: 2026,
        month: 7,
        scope: 'family',
        owner_user_id: null,
        created_at: '2026-07-01T00:00:00Z',
      };

      const budget = Mapper.toDomainBudget(dbBudget);
      expect(budget.amountLimit).toBe(600);

      const dbRow = Mapper.toDbBudget(budget);
      expect(dbRow.amount_limit).toBe(600);
    });
  });

  describe('SavingsGoal Mapping', () => {
    it('mapea bidireccionalmente la entidad SavingsGoal', () => {
      const dbGoal = {
        id: 'sg-1',
        family_group_id: 'fam-1',
        owner_user_id: 'usr-1',
        name: 'Fondo de Viaje',
        target_amount: '3000.00',
        current_amount: '1200.00',
        target_date: '2026-12-31',
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
      };

      const goal = Mapper.toDomainSavingsGoal(dbGoal);
      expect(goal.targetAmount).toBe(3000);

      const dbRow = Mapper.toDbSavingsGoal(goal);
      expect(dbRow.target_amount).toBe(3000);
    });
  });

  describe('RecurringRule Mapping', () => {
    it('mapea bidireccionalmente la entidad RecurringRule', () => {
      const dbRule = {
        id: 'rec-1',
        family_group_id: 'fam-1',
        account_id: 'acc-1',
        category_id: 'cat-sub',
        type: 'expense',
        amount: '15.99',
        description: 'Netflix',
        frequency: 'monthly',
        day_of_month: 10,
        start_date: '2026-01-10',
        end_date: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      };

      const rule = Mapper.toDomainRecurringRule(dbRule);
      expect(rule.amount).toBe(15.99);

      const dbRow = Mapper.toDbRecurringRule(rule);
      expect(dbRow.amount).toBe(15.99);
    });
  });

  describe('CategorizationRule & AssistantMessage Mapping', () => {
    it('mapea CategorizationRule bidireccionalmente', () => {
      const dbRule = {
        id: 'catrule-1',
        family_group_id: 'fam-1',
        match_pattern: 'uber',
        category_id: 'cat-transporte',
        priority: 10,
        is_ai_generated: false,
        created_at: '2026-01-01T00:00:00Z',
      };

      const rule = Mapper.toDomainCategorizationRule(dbRule);
      expect(rule.matchPattern).toBe('uber');

      const dbRow = Mapper.toDbCategorizationRule(rule);
      expect(dbRow.match_pattern).toBe('uber');
    });

    it('mapea AssistantMessage a dominio', () => {
      const dbMsg = {
        id: 'msg-1',
        family_group_id: 'fam-1',
        user_id: 'usr-1',
        sender: 'assistant',
        content: 'Hola, ¿en qué te puedo ayudar?',
        suggested_actions: ['Agregar gasto', 'Ver presupuesto'],
        created_at: '2026-01-01T00:00:00Z',
      };

      const msg = Mapper.toDomainAssistantMessage(dbMsg);
      expect(msg.content).toBe('Hola, ¿en qué te puedo ayudar?');
      expect(msg.suggestedActions).toHaveLength(2);
    });
  });

});
