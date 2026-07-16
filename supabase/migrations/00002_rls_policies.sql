-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00002: Row-Level Security (RLS) Policies
--
-- Enables RLS on every table and defines granular access policies based on
-- family group membership and user role (admin / editor / viewer).
-- ============================================================================


-- ============================================================================
-- HELPER FUNCTIONS
-- SECURITY DEFINER so they execute with the function owner's privileges,
-- allowing them to read user_profiles even when RLS is active.
-- ============================================================================

-- Returns the family_group_id for the currently authenticated user.
CREATE OR REPLACE FUNCTION public.get_user_family_group_id()
RETURNS uuid AS $$
    SELECT family_group_id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the role ('admin', 'editor', 'viewer') for the currently authenticated user.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
    SELECT role
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
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


-- ============================================================================
-- 1. family_groups
-- ============================================================================

-- Any authenticated member can view their own family group.
CREATE POLICY family_groups_select ON public.family_groups
    FOR SELECT
    USING (id = public.get_user_family_group_id());

-- Any authenticated user can create a family group during signup.
CREATE POLICY family_groups_insert ON public.family_groups
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Only admins can update the family group.
CREATE POLICY family_groups_update ON public.family_groups
    FOR UPDATE
    USING (
        id = public.get_user_family_group_id()
        AND public.get_user_role() = 'admin'
    );


-- ============================================================================
-- 2. user_profiles
-- ============================================================================

-- Members can see all profiles within their family group.
CREATE POLICY user_profiles_select ON public.user_profiles
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

-- Allow inserting user profiles under two conditions:
-- 1. A new user is creating their own profile (auth_user_id matches session uid)
-- 2. An existing admin is creating/inviting another profile in their family group
CREATE POLICY user_profiles_insert ON public.user_profiles
    FOR INSERT
    WITH CHECK (
        auth_user_id = auth.uid()
        OR (
            family_group_id = public.get_user_family_group_id()
            AND public.get_user_role() = 'admin'
        )
    );

-- Only admins can update profiles (e.g. change roles).
CREATE POLICY user_profiles_update ON public.user_profiles
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() = 'admin'
    );


-- ============================================================================
-- 3. accounts
-- ============================================================================

-- All family members can view accounts.
CREATE POLICY accounts_select ON public.accounts
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

-- Editors and admins can create accounts.
CREATE POLICY accounts_insert ON public.accounts
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- Editors and admins can update accounts.
CREATE POLICY accounts_update ON public.accounts
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- Editors and admins can delete accounts.
CREATE POLICY accounts_delete ON public.accounts
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );


-- ============================================================================
-- 4. categories
-- ============================================================================

-- Users can see system categories (is_system = true) OR their own family's categories.
CREATE POLICY categories_select ON public.categories
    FOR SELECT
    USING (
        is_system = true
        OR family_group_id = public.get_user_family_group_id()
    );

-- Editors and admins can create categories for their family.
CREATE POLICY categories_insert ON public.categories
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- Editors and admins can update their family's categories.
CREATE POLICY categories_update ON public.categories
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- Editors and admins can delete their family's categories.
CREATE POLICY categories_delete ON public.categories
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );


-- ============================================================================
-- 5. transactions
-- ============================================================================

-- All family members can view transactions.
CREATE POLICY transactions_select ON public.transactions
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

-- Editors and admins can create transactions.
CREATE POLICY transactions_insert ON public.transactions
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- Editors and admins can update transactions.
CREATE POLICY transactions_update ON public.transactions
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

-- Editors and admins can delete transactions.
CREATE POLICY transactions_delete ON public.transactions
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );


-- ============================================================================
-- 6. recurring_rules
-- ============================================================================

CREATE POLICY recurring_rules_select ON public.recurring_rules
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

CREATE POLICY recurring_rules_insert ON public.recurring_rules
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY recurring_rules_update ON public.recurring_rules
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY recurring_rules_delete ON public.recurring_rules
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );


-- ============================================================================
-- 7. budgets
-- ============================================================================

CREATE POLICY budgets_select ON public.budgets
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

CREATE POLICY budgets_insert ON public.budgets
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY budgets_update ON public.budgets
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY budgets_delete ON public.budgets
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );


-- ============================================================================
-- 8. savings_goals
-- ============================================================================

CREATE POLICY savings_goals_select ON public.savings_goals
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

CREATE POLICY savings_goals_insert ON public.savings_goals
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY savings_goals_update ON public.savings_goals
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY savings_goals_delete ON public.savings_goals
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );


-- ============================================================================
-- 9. auto_categorization_rules
-- ============================================================================

CREATE POLICY auto_cat_rules_select ON public.auto_categorization_rules
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

CREATE POLICY auto_cat_rules_insert ON public.auto_categorization_rules
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY auto_cat_rules_update ON public.auto_categorization_rules
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY auto_cat_rules_delete ON public.auto_categorization_rules
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );


-- ============================================================================
-- 10. notification_preferences
-- Users can only manage their own notification preferences.
-- ============================================================================

CREATE POLICY notification_prefs_select ON public.notification_preferences
    FOR SELECT
    USING (
        user_id = (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY notification_prefs_insert ON public.notification_preferences
    FOR INSERT
    WITH CHECK (
        user_id = (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY notification_prefs_update ON public.notification_preferences
    FOR UPDATE
    USING (
        user_id = (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY notification_prefs_delete ON public.notification_preferences
    FOR DELETE
    USING (
        user_id = (
            SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()
        )
    );
