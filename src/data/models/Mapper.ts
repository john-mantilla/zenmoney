/**
 * ZenMoney — Mapeadores de Base de Datos a Entidades del Dominio
 *
 * Convierte los registros de Supabase (snake_case) en entidades del dominio (camelCase)
 * y viceversa.
 */

import { Transaction, AIMetadata } from '@domain/entities/Transaction';
import { Account } from '@domain/entities/Account';
import { Category } from '@domain/entities/Category';
import { Budget } from '@domain/entities/Budget';
import { UserProfile, FamilyGroup } from '@domain/entities/User';
import { RecurringRule } from '@domain/entities/RecurringRule';
import { SavingsGoal } from '@domain/entities/SavingsGoal';
import { CategorizationRule } from '@domain/entities/CategorizationRule';
import { AssistantMessage } from '@domain/entities/AssistantMessage';

export class Mapper {
  
  // ─── User Profile & Family Group ──────────────────────────────────────

  static toDomainUserProfile(row: any): UserProfile {
    return {
      id: row.id,
      authUserId: row.auth_user_id,
      familyGroupId: row.family_group_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  static toDomainFamilyGroup(row: any): FamilyGroup {
    return {
      id: row.id,
      name: row.name,
      currencyDefault: row.currency_default,
      inboundToken: row.inbound_token,
      createdAt: row.created_at,
    };
  }

  // ─── Accounts ──────────────────────────────────────────────────────────

  static toDomainAccount(row: any): Account {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      ownerUserId: row.owner_user_id,
      name: row.name,
      type: row.type,
      initialBalance: Number(row.initial_balance),
      currency: row.currency,
      isActive: row.is_active,
      createdAt: row.created_at,
      closingDay: row.closing_day ? Number(row.closing_day) : null,
      paymentDay: row.payment_day ? Number(row.payment_day) : null,
      isPrivate: row.is_private === true,
    };
  }

  static toDbAccount(entity: Partial<Account>): any {
    return {
      ...(entity.id && { id: entity.id }),
      ...(entity.familyGroupId && { family_group_id: entity.familyGroupId }),
      ...(entity.ownerUserId && { owner_user_id: entity.ownerUserId }),
      ...(entity.name && { name: entity.name }),
      ...(entity.type && { type: entity.type }),
      ...(entity.initialBalance !== undefined && { initial_balance: entity.initialBalance }),
      ...(entity.currency && { currency: entity.currency }),
      ...(entity.isActive !== undefined && { is_active: entity.isActive }),
      ...(entity.closingDay !== undefined && { closing_day: entity.closingDay }),
      ...(entity.paymentDay !== undefined && { payment_day: entity.paymentDay }),
      ...(entity.isPrivate !== undefined && { is_private: entity.isPrivate }),
    };
  }

  // ─── Categories ───────────────────────────────────────────────────────

  static toDomainCategory(row: any): Category {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      parentCategoryId: row.parent_category_id,
      isSystem: row.is_system,
      isPrivate: row.is_private,
      createdAt: row.created_at,
    };
  }

  static toDbCategory(entity: Partial<Category>): any {
    return {
      ...(entity.id && { id: entity.id }),
      ...(entity.familyGroupId !== undefined && { family_group_id: entity.familyGroupId || null }),
      ...(entity.name && { name: entity.name }),
      ...(entity.icon && { icon: entity.icon }),
      ...(entity.color && { color: entity.color }),
      ...(entity.parentCategoryId !== undefined && { parent_category_id: entity.parentCategoryId || null }),
      ...(entity.isSystem !== undefined && { is_system: entity.isSystem }),
      ...(entity.isPrivate !== undefined && { is_private: entity.isPrivate }),
    };
  }

  // ─── Transactions ──────────────────────────────────────────────────────

  static toDomainTransaction(row: any): Transaction {
    const isPrivate = row.is_private === true;
    let description = row.description;
    let merchantName = row.merchant_name;
    let categoryId = row.category_id;
    let aiMetadata: AIMetadata | null = null;

    let isOwner = true;
    if (isPrivate) {
      let currentUserId: string | undefined;
      try {
        const store = require('../../infrastructure/auth/authStore');
        currentUserId = store.useAuthStore.getState().userProfile?.id;
      } catch (e) {
        // Ignorar
      }
      if (currentUserId && row.created_by_user_id) {
        isOwner = currentUserId === row.created_by_user_id;
      }
    }

    if (row.ai_metadata && (!isPrivate || isOwner)) {
      const meta = row.ai_metadata;
      let installments = meta.installments || null;
      if (typeof installments === 'string') {
        try {
          installments = JSON.parse(installments);
        } catch {
          installments = null;
        }
      }
      aiMetadata = {
        rawInput: meta.raw_input || '',
        parsedAmount: meta.parsed_amount !== undefined ? meta.parsed_amount : null,
        parsedCategory: meta.parsed_category || null,
        parsedAccount: meta.parsed_account || null,
        parsedMerchant: meta.parsed_merchant || null,
        confidence: meta.confidence || 0,
        corrections: meta.corrections || {},
        dueDate: meta.due_date || undefined,
        installments,
        isCCStatement: meta.is_cc_statement || false,
      } as any;
    }

    if (isPrivate && !isOwner) {
      description = 'Transacción Privada';
      merchantName = null;
      categoryId = null;
    }

    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      accountId: row.account_id,
      categoryId,
      createdByUserId: row.created_by_user_id,
      type: row.type,
      amount: Number(row.amount),
      currency: row.currency,
      description,
      merchantName,
      transactionDate: row.transaction_date,
      transferToAccountId: row.transfer_to_account_id,
      isRecurringInstance: row.is_recurring_instance,
      recurringRuleId: row.recurring_rule_id,
      status: row.status,
      inputMethod: row.input_method,
      aiMetadata,
      isPrivate,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
    };
  }

  static toDbTransaction(entity: Partial<Transaction>): any {
    let ai_metadata = null;
    if (entity.aiMetadata) {
      const meta = entity.aiMetadata;
      ai_metadata = {
        raw_input: meta.rawInput,
        parsed_amount: meta.parsedAmount,
        parsed_category: meta.parsedCategory,
        parsed_account: meta.parsedAccount,
        parsed_merchant: meta.parsedMerchant,
        confidence: meta.confidence,
        corrections: meta.corrections,
        due_date: meta.dueDate || null,
        installments: (meta as any).installments || null,
        is_cc_statement: (meta as any).isCCStatement || false,
      };
    }

    return {
      ...(entity.id && { id: entity.id }),
      ...(entity.familyGroupId && { family_group_id: entity.familyGroupId }),
      ...(entity.accountId && { account_id: entity.accountId }),
      category_id: entity.categoryId || null,
      ...(entity.createdByUserId && { created_by_user_id: entity.createdByUserId }),
      ...(entity.type && { type: entity.type }),
      ...(entity.amount !== undefined && { amount: entity.amount }),
      ...(entity.currency && { currency: entity.currency }),
      description: entity.description || null,
      merchant_name: entity.merchantName || null,
      ...(entity.transactionDate && { transaction_date: entity.transactionDate }),
      transfer_to_account_id: entity.transferToAccountId || null,
      ...(entity.isRecurringInstance !== undefined && { is_recurring_instance: entity.isRecurringInstance }),
      recurring_rule_id: entity.recurringRuleId || null,
      ...(entity.status && { status: entity.status }),
      ...(entity.inputMethod && { input_method: entity.inputMethod }),
      ...(entity.isPrivate !== undefined && { is_private: entity.isPrivate }),
      ai_metadata,
    };
  }

  // ─── Recurring Rules ──────────────────────────────────────────────────

  static toDomainRecurringRule(row: any): RecurringRule {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      accountId: row.account_id,
      categoryId: row.category_id,
      type: row.type,
      amount: Number(row.amount),
      description: row.description,
      frequency: row.frequency,
      dayOfMonth: row.day_of_month,
      startDate: row.start_date,
      endDate: row.end_date,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }

  static toDbRecurringRule(entity: Partial<RecurringRule>): any {
    return {
      ...(entity.id && { id: entity.id }),
      ...(entity.familyGroupId && { family_group_id: entity.familyGroupId }),
      ...(entity.accountId && { account_id: entity.accountId }),
      ...(entity.categoryId !== undefined && { category_id: entity.categoryId || null }),
      ...(entity.type && { type: entity.type }),
      ...(entity.amount !== undefined && { amount: entity.amount }),
      ...(entity.description !== undefined && { description: entity.description || null }),
      ...(entity.frequency && { frequency: entity.frequency }),
      ...(entity.dayOfMonth !== undefined && { day_of_month: entity.dayOfMonth || null }),
      ...(entity.startDate && { start_date: entity.startDate }),
      ...(entity.endDate !== undefined && { end_date: entity.endDate || null }),
      ...(entity.isActive !== undefined && { is_active: entity.isActive }),
    };
  }

  // ─── Budgets ───────────────────────────────────────────────────────────

  static toDomainBudget(row: any): Budget {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      categoryId: row.category_id,
      amountLimit: Number(row.amount_limit),
      year: row.year,
      month: row.month,
      scope: row.scope,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at,
    };
  }

  static toDbBudget(entity: Partial<Budget>): any {
    return {
      ...(entity.id && { id: entity.id }),
      ...(entity.familyGroupId && { family_group_id: entity.familyGroupId }),
      ...(entity.categoryId && { category_id: entity.categoryId }),
      ...(entity.amountLimit !== undefined && { amount_limit: entity.amountLimit }),
      ...(entity.year !== undefined && { year: entity.year }),
      ...(entity.month !== undefined && { month: entity.month }),
      ...(entity.scope && { scope: entity.scope }),
      owner_user_id: entity.ownerUserId || null,
    };
  }

  // ─── Savings Goals ────────────────────────────────────────────────────

  static toDomainSavingsGoal(row: any): SavingsGoal {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      ownerUserId: row.owner_user_id,
      name: row.name,
      targetAmount: Number(row.target_amount),
      currentAmount: Number(row.current_amount),
      targetDate: row.target_date,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  static toDbSavingsGoal(entity: Partial<SavingsGoal>): any {
    return {
      ...(entity.id && { id: entity.id }),
      ...(entity.familyGroupId && { family_group_id: entity.familyGroupId }),
      ...(entity.ownerUserId && { owner_user_id: entity.ownerUserId }),
      ...(entity.name && { name: entity.name }),
      ...(entity.targetAmount !== undefined && { target_amount: entity.targetAmount }),
      ...(entity.currentAmount !== undefined && { current_amount: entity.currentAmount }),
      ...(entity.targetDate && { target_date: entity.targetDate }),
      ...(entity.status && { status: entity.status }),
    };
  }

  // ─── Categorization Rules ──────────────────────────────────────────────

  static toDomainCategorizationRule(row: any): CategorizationRule {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      matchPattern: row.match_pattern,
      categoryId: row.category_id,
      priority: row.priority,
      isAiGenerated: row.is_ai_generated,
      createdAt: row.created_at,
    };
  }

  static toDbCategorizationRule(entity: Partial<CategorizationRule>): any {
    return {
      ...(entity.id && { id: entity.id }),
      ...(entity.familyGroupId && { family_group_id: entity.familyGroupId }),
      ...(entity.matchPattern && { match_pattern: entity.matchPattern }),
      ...(entity.categoryId && { category_id: entity.categoryId }),
      ...(entity.priority !== undefined && { priority: entity.priority }),
      ...(entity.isAiGenerated !== undefined && { is_ai_generated: entity.isAiGenerated }),
    };
  }

  // ─── Assistant Messages ─────────────────────────────────────────────────

  static toDomainAssistantMessage(row: any): AssistantMessage {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      userId: row.user_id,
      sender: row.sender,
      content: row.content,
      suggestedActions: row.suggested_actions || [],
      createdAt: row.created_at,
    };
  }
}
