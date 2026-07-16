-- Migración: 00009_family_invitation_helpers.sql
-- Propósito: Crear funciones RPC seguras (SECURITY DEFINER) para consultar y aceptar invitaciones de familia durante el registro de nuevos usuarios, evitando problemas con políticas RLS de Supabase.

-- 1. Función para buscar una invitación pendiente por correo electrónico
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para marcar una invitación como aceptada
CREATE OR REPLACE FUNCTION public.accept_family_invitation(invitation_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.family_invitations
    SET status = 'accepted'
    WHERE id = invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
