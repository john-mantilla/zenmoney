-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00005: Per-Transaction Privacy
--
-- Allows a family member to hide a single transaction from the rest of the
-- household (ej. a surprise gift), similar to Monarch's "eye icon". Scoped to
-- accounts the creator personally owns, so a hidden transaction never
-- distorts the balance other members see for a shared account.
-- ============================================================================

ALTER TABLE public.transactions
    ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- Returns the user_profiles.id for the currently authenticated user.
CREATE OR REPLACE FUNCTION public.get_user_profile_id()
RETURNS uuid AS $$
    SELECT id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- transactions: replace select/insert/update/delete policies
-- ============================================================================

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
        AND (
            is_private = false
            OR EXISTS (
                SELECT 1 FROM public.accounts a
                WHERE a.id = account_id AND a.owner_user_id = created_by_user_id
            )
        )
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
    )
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
        AND (
            is_private = false
            OR EXISTS (
                SELECT 1 FROM public.accounts a
                WHERE a.id = account_id AND a.owner_user_id = created_by_user_id
            )
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
