-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00016: RPC remove_family_member
--
-- Desvincula a un miembro del grupo familiar de forma atómica y segura.
-- Crea su nuevo grupo individual, transfiere sus cuentas privadas
-- y preserva las transacciones y saldos de las cuentas compartidas en la familia.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_family_member(member_profile_id uuid)
RETURNS jsonb AS $$
DECLARE
    caller_profile_id uuid;
    caller_family_id uuid;
    caller_role text;
    target_profile_id uuid;
    target_name text;
    target_email text;
    target_family_id uuid;
    new_family_id uuid;
BEGIN
    -- 1. Obtener perfil y rol de quien invoca la función
    SELECT id, family_group_id, role 
    INTO caller_profile_id, caller_family_id, caller_role
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid();

    IF caller_family_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado o sin perfil asignado.';
    END IF;

    IF caller_role != 'admin' THEN
        RAISE EXCEPTION 'Solo un administrador puede desvincular miembros del grupo familiar.';
    END IF;

    -- 2. Obtener datos del miembro objetivo
    SELECT id, display_name, email, family_group_id 
    INTO target_profile_id, target_name, target_email, target_family_id
    FROM public.user_profiles
    WHERE id = member_profile_id;

    IF target_profile_id IS NULL THEN
        RAISE EXCEPTION 'El miembro especificado no existe.';
    END IF;

    IF target_family_id != caller_family_id THEN
        RAISE EXCEPTION 'El miembro no pertenece a tu grupo familiar.';
    END IF;

    IF target_profile_id = caller_profile_id THEN
        RAISE EXCEPTION 'El administrador principal no puede desvincularse a sí mismo.';
    END IF;

    -- 3. Crear nuevo grupo familiar personal para el miembro desvinculado
    new_family_id := gen_random_uuid();
    INSERT INTO public.family_groups (id, name, currency_default, created_at)
    VALUES (new_family_id, 'Familia de ' || COALESCE(NULLIF(TRIM(target_name), ''), 'Usuario'), 'COP', now());

    -- 4. Mover el perfil del usuario a su nuevo grupo como admin
    UPDATE public.user_profiles
    SET family_group_id = new_family_id,
        role = 'admin'
    WHERE id = target_profile_id;

    -- 5. Trasladar sus cuentas marcadas como privadas y las transacciones de esas cuentas al nuevo grupo
    -- (Las cuentas compartidas y sus transacciones históricas permanecen intactas en el grupo familiar original)
    UPDATE public.accounts
    SET family_group_id = new_family_id
    WHERE owner_user_id = target_profile_id AND is_private = true;

    UPDATE public.transactions
    SET family_group_id = new_family_id
    WHERE account_id IN (
        SELECT id FROM public.accounts WHERE family_group_id = new_family_id
    );

    -- 6. Limpiar el registro de invitación de la tabla family_invitations
    DELETE FROM public.family_invitations
    WHERE family_group_id = caller_family_id
      AND LOWER(invited_email) = LOWER(target_email);

    RETURN jsonb_build_object(
        'success', true,
        'new_family_group_id', new_family_id,
        'unlinked_member_id', target_profile_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Revocar de PUBLIC y otorgar permisos solo a usuarios autenticados
REVOKE EXECUTE ON FUNCTION public.remove_family_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_family_member(uuid) TO authenticated;
