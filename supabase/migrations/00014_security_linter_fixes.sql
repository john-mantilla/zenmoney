-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00014: Security Linter Fixes
--
-- Addresses Supabase Security Advisor warnings:
-- 1. Function Search Path Mutable (Adds SET search_path = '' to all SECURITY DEFINER functions)
-- 2. Public Can Execute SECURITY DEFINER Function (Revokes EXECUTE from PUBLIC for internal helpers)
-- ============================================================================

-- Fix 1: Add SET search_path = '' to all SECURITY DEFINER functions to prevent search path hijacking

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_user_profile_id()
RETURNS uuid AS $$
    SELECT id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_user_family_group_id()
RETURNS uuid AS $$
    SELECT family_group_id
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
    SELECT role
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_pending_invitation_by_email(email_to_check text)
RETURNS TABLE (
    id uuid,
    family_group_id uuid,
    invited_email text,
    role text,
    status text,
    invited_by_user_id uuid,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT fi.id, fi.family_group_id, fi.invited_email, fi.role, fi.status, fi.invited_by_user_id, fi.created_at
    FROM public.family_invitations fi
    WHERE fi.invited_email = email_to_check
      AND fi.status = 'pending'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.accept_family_invitation(invitation_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.family_invitations
    SET status = 'accepted'
    WHERE id = invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix 2: Revoke EXECUTE from PUBLIC (anon role) for internal helper functions.

REVOKE EXECUTE ON FUNCTION public.get_user_profile_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_family_group_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_family_group_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
