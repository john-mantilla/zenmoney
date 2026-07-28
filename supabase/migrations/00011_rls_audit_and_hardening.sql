-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00011: RLS Audit, Hardening & Multi-Tenant Isolation
--
-- Revalidación e hiper-reforzamiento de Row-Level Security (RLS) en todas las tablas.
-- Garantiza aislamiento estricto por family_group_id, privacidad personal (is_private),
-- y restricción de escrituras para roles tipo 'viewer'.
-- ============================================================================

-- 1. ASEGURAR RLS EN EL 100% DE LAS TABLAS
ALTER TABLE public.family_groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_categorization_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages         ENABLE ROW LEVEL SECURITY;

-- 2. HELPER FUNCTIONS PARA SEGURIDAD SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_user_profile_id()
RETURNS uuid AS $$
    SELECT id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_family_group_id()
RETURNS uuid AS $$
    SELECT family_group_id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
    SELECT role
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. POLÍTICAS DE AUDITORÍA Y HARDENING POR TABLA

-- ----------------------------------------------------------------------------
-- TABLA: accounts (Soporte de Privacidad + Rol Viewer)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS accounts_select ON public.accounts;
CREATE POLICY accounts_select ON public.accounts
    FOR SELECT
    USING (
        family_group_id = public.get_user_family_group_id()
        AND (
            is_private = false
            OR created_by_user_id = public.get_user_profile_id()
        )
    );

DROP POLICY IF EXISTS accounts_insert ON public.accounts;
CREATE POLICY accounts_insert ON public.accounts
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS accounts_update ON public.accounts;
CREATE POLICY accounts_update ON public.accounts
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
        AND (
            is_private = false
            OR created_by_user_id = public.get_user_profile_id()
        )
    );

DROP POLICY IF EXISTS accounts_delete ON public.accounts;
CREATE POLICY accounts_delete ON public.accounts
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() = 'admin'
        AND (
            is_private = false
            OR created_by_user_id = public.get_user_profile_id()
        )
    );

-- ----------------------------------------------------------------------------
-- TABLA: transactions (Soporte de Privacidad + Rol Viewer)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS transactions_select ON public.transactions;
CREATE POLICY transactions_select ON public.transactions
    FOR SELECT
    USING (
        family_group_id = public.get_user_family_group_id()
        AND (
            is_private = false
            OR created_by_user_id = public.get_user_profile_id()
        )
    );

DROP POLICY IF EXISTS transactions_insert ON public.transactions;
CREATE POLICY transactions_insert ON public.transactions
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS transactions_update ON public.transactions;
CREATE POLICY transactions_update ON public.transactions
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
        AND (
            is_private = false
            OR created_by_user_id = public.get_user_profile_id()
        )
    );

DROP POLICY IF EXISTS transactions_delete ON public.transactions;
CREATE POLICY transactions_delete ON public.transactions
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
        AND (
            is_private = false
            OR created_by_user_id = public.get_user_profile_id()
        )
    );

-- ----------------------------------------------------------------------------
-- TABLA: budgets (Rol Viewer Bloqueado)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS budgets_insert ON public.budgets;
CREATE POLICY budgets_insert ON public.budgets
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS budgets_update ON public.budgets;
CREATE POLICY budgets_update ON public.budgets
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS budgets_delete ON public.budgets;
CREATE POLICY budgets_delete ON public.budgets
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- ----------------------------------------------------------------------------
-- TABLA: savings_goals (Rol Viewer Bloqueado)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS savings_goals_insert ON public.savings_goals;
CREATE POLICY savings_goals_insert ON public.savings_goals
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS savings_goals_update ON public.savings_goals;
CREATE POLICY savings_goals_update ON public.savings_goals
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS savings_goals_delete ON public.savings_goals;
CREATE POLICY savings_goals_delete ON public.savings_goals
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- ----------------------------------------------------------------------------
-- TABLA: assistant_messages (Privacidad Estricta por Usuario)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS assistant_messages_select ON public.assistant_messages;
CREATE POLICY assistant_messages_select ON public.assistant_messages
    FOR SELECT
    USING (user_id = public.get_user_profile_id());

DROP POLICY IF EXISTS assistant_messages_insert ON public.assistant_messages;
CREATE POLICY assistant_messages_insert ON public.assistant_messages
    FOR INSERT
    WITH CHECK (
        user_id = public.get_user_profile_id()
        AND family_group_id = public.get_user_family_group_id()
    );

DROP POLICY IF EXISTS assistant_messages_delete ON public.assistant_messages;
CREATE POLICY assistant_messages_delete ON public.assistant_messages
    FOR DELETE
    USING (user_id = public.get_user_profile_id());
