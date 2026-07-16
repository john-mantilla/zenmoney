-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00001: Initial Schema
-- 
-- Creates all core tables, indexes, and triggers for the ZenMoney database.
-- Tables are created in dependency order to satisfy foreign key constraints.
-- ============================================================================

-- ==========================================================
-- 1. family_groups
-- Top-level grouping entity. Every family/household gets one.
-- ==========================================================
CREATE TABLE public.family_groups (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text        NOT NULL,
    currency_default text       NOT NULL DEFAULT 'COP',
    created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE public.family_groups IS 'Top-level grouping entity representing a family or household.';

-- ==========================================================
-- 2. user_profiles
-- Links Supabase Auth users to a family group with a role.
-- ==========================================================
CREATE TABLE public.user_profiles (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_group_id  uuid        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    display_name     text        NOT NULL,
    email            text        NOT NULL,
    role             text        NOT NULL DEFAULT 'editor'
                                 CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at       timestamptz DEFAULT now(),

    CONSTRAINT uq_user_profiles_auth_user_id UNIQUE (auth_user_id)
);

COMMENT ON TABLE public.user_profiles IS 'Application-level user profile linked to Supabase Auth and a family group.';

-- ==========================================================
-- 3. accounts
-- Bank accounts, wallets, credit cards, investments.
-- ==========================================================
CREATE TABLE public.accounts (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id  uuid          NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    owner_user_id    uuid          NOT NULL REFERENCES public.user_profiles(id),
    name             text          NOT NULL,
    type             text          NOT NULL
                                   CHECK (type IN ('cash', 'bank', 'credit_card', 'investment', 'loan', 'mortgage')),
    initial_balance  numeric(15,2) NOT NULL DEFAULT 0,
    currency         text          NOT NULL DEFAULT 'COP',
    is_active        boolean       DEFAULT true,
    created_at       timestamptz   DEFAULT now()
);

COMMENT ON TABLE public.accounts IS 'Financial accounts owned by a user within a family group.';

-- ==========================================================
-- 4. categories
-- Hierarchical transaction categories (system + user-defined).
-- ==========================================================
CREATE TABLE public.categories (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id     uuid        REFERENCES public.family_groups(id) ON DELETE CASCADE,
    name                text        NOT NULL,
    icon                text        NOT NULL DEFAULT 'tag',
    color               text        NOT NULL DEFAULT '#808080',
    parent_category_id  uuid        REFERENCES public.categories(id) ON DELETE SET NULL,
    is_system           boolean     DEFAULT false,
    is_private          boolean     DEFAULT false,
    created_at          timestamptz DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Transaction categories. System categories have is_system=true and NULL family_group_id.';

-- ==========================================================
-- 5. recurring_rules
-- Templates for automatically generating recurring transactions.
-- ==========================================================
CREATE TABLE public.recurring_rules (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id  uuid          NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    account_id       uuid          NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id      uuid          REFERENCES public.categories(id) ON DELETE SET NULL,
    type             text          NOT NULL
                                   CHECK (type IN ('income', 'expense')),
    amount           numeric(15,2) NOT NULL
                                   CHECK (amount > 0),
    description      text,
    frequency        text          NOT NULL
                                   CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
    day_of_month     integer       CHECK (day_of_month BETWEEN 1 AND 31),
    start_date       date          NOT NULL,
    end_date         date,
    is_active        boolean       DEFAULT true,
    created_at       timestamptz   DEFAULT now()
);

COMMENT ON TABLE public.recurring_rules IS 'Defines recurring transaction patterns (e.g. monthly rent, salary).';

-- ==========================================================
-- 6. transactions
-- The core financial ledger — every income, expense, transfer.
-- ==========================================================
CREATE TABLE public.transactions (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id         uuid          NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    account_id              uuid          NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id             uuid          REFERENCES public.categories(id) ON DELETE SET NULL,
    created_by_user_id      uuid          NOT NULL REFERENCES public.user_profiles(id),
    type                    text          NOT NULL
                                          CHECK (type IN ('income', 'expense', 'transfer')),
    amount                  numeric(15,2) NOT NULL
                                          CHECK (amount > 0),
    currency                text          NOT NULL DEFAULT 'COP',
    description             text,
    merchant_name           text,
    transaction_date        date          NOT NULL DEFAULT CURRENT_DATE,
    transfer_to_account_id  uuid          REFERENCES public.accounts(id),
    is_recurring_instance   boolean       DEFAULT false,
    recurring_rule_id       uuid          REFERENCES public.recurring_rules(id) ON DELETE SET NULL,
    status                  text          NOT NULL DEFAULT 'confirmed'
                                          CHECK (status IN ('confirmed', 'pending')),
    input_method            text          NOT NULL DEFAULT 'manual'
                                          CHECK (input_method IN ('manual', 'voice', 'nlq')),
    ai_metadata             jsonb,
    created_at              timestamptz   DEFAULT now(),
    updated_at              timestamptz   DEFAULT now(),
    synced_at               timestamptz
);

COMMENT ON TABLE public.transactions IS 'Core financial ledger recording every income, expense, and transfer.';

-- ==========================================================
-- 7. budgets
-- Monthly spending limits per category, family or individual.
-- ==========================================================
CREATE TABLE public.budgets (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id  uuid          NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    category_id      uuid          NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    amount_limit     numeric(15,2) NOT NULL
                                   CHECK (amount_limit > 0),
    year             integer       NOT NULL,
    month            integer       NOT NULL
                                   CHECK (month BETWEEN 1 AND 12),
    scope            text          NOT NULL DEFAULT 'family'
                                   CHECK (scope IN ('family', 'individual')),
    owner_user_id    uuid          REFERENCES public.user_profiles(id),
    created_at       timestamptz   DEFAULT now()
);

COMMENT ON TABLE public.budgets IS 'Monthly spending limits per category, scoped to family or individual.';

-- ==========================================================
-- 8. savings_goals
-- Track progress toward specific savings targets.
-- ==========================================================
CREATE TABLE public.savings_goals (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id  uuid          NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    owner_user_id    uuid          NOT NULL REFERENCES public.user_profiles(id),
    name             text          NOT NULL,
    target_amount    numeric(15,2) NOT NULL
                                   CHECK (target_amount > 0),
    current_amount   numeric(15,2) NOT NULL DEFAULT 0
                                   CHECK (current_amount >= 0),
    target_date      date          NOT NULL,
    status           text          NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at       timestamptz   DEFAULT now()
);

COMMENT ON TABLE public.savings_goals IS 'Personal savings goals with target amounts and deadlines.';

-- ==========================================================
-- 9. auto_categorization_rules
-- Pattern-matching rules to auto-assign categories.
-- ==========================================================
CREATE TABLE public.auto_categorization_rules (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id  uuid        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    match_pattern    text        NOT NULL,
    category_id      uuid        NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    priority         integer     NOT NULL DEFAULT 0,
    is_ai_generated  boolean     DEFAULT false,
    created_at       timestamptz DEFAULT now()
);

COMMENT ON TABLE public.auto_categorization_rules IS 'Rules for automatic transaction categorization based on text patterns.';

-- ==========================================================
-- 10. notification_preferences
-- Per-user notification settings by type.
-- ==========================================================
CREATE TABLE public.notification_preferences (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type        text        NOT NULL
                            CHECK (type IN ('budget_80', 'budget_100', 'unusual_expense', 'low_balance', 'payment_due')),
    enabled     boolean     DEFAULT true,
    config      jsonb       DEFAULT '{}',
    created_at  timestamptz DEFAULT now(),

    CONSTRAINT uq_notification_preferences_user_type UNIQUE (user_id, type)
);

COMMENT ON TABLE public.notification_preferences IS 'Per-user notification preferences for budget alerts, low balance, etc.';


-- ============================================================================
-- INDEXES
-- Optimise the most common query patterns (dashboards, reports, filters).
-- ============================================================================

-- transactions — primary query axes
CREATE INDEX idx_transactions_family_date
    ON public.transactions (family_group_id, transaction_date DESC);

CREATE INDEX idx_transactions_family_account
    ON public.transactions (family_group_id, account_id);

CREATE INDEX idx_transactions_family_category
    ON public.transactions (family_group_id, category_id);

CREATE INDEX idx_transactions_family_user
    ON public.transactions (family_group_id, created_by_user_id);

-- accounts
CREATE INDEX idx_accounts_family
    ON public.accounts (family_group_id);

-- categories
CREATE INDEX idx_categories_family
    ON public.categories (family_group_id);

-- budgets
CREATE INDEX idx_budgets_family_period
    ON public.budgets (family_group_id, year, month);

CREATE UNIQUE INDEX uq_idx_budgets_unique_limit
    ON public.budgets (
        family_group_id,
        category_id,
        year,
        month,
        scope,
        COALESCE(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- user_profiles
CREATE INDEX idx_user_profiles_family
    ON public.user_profiles (family_group_id);

CREATE INDEX idx_user_profiles_auth_user
    ON public.user_profiles (auth_user_id);

-- auto_categorization_rules
CREATE INDEX idx_auto_cat_rules_family_priority
    ON public.auto_categorization_rules (family_group_id, priority);


-- ============================================================================
-- TRIGGER: Auto-update `updated_at` on transactions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_set_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
