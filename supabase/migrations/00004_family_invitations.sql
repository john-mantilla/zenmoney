-- Migración: 00004_family_invitations.sql
-- Propósito: Crear la tabla de invitaciones familiares y sus políticas RLS

CREATE TABLE IF NOT EXISTS public.family_invitations (
    id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
    family_group_id     uuid          NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    invited_email       text          NOT NULL,
    role                text          NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
    status              text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    invited_by_user_id  uuid          NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at          timestamptz   DEFAULT now(),
    UNIQUE (family_group_id, invited_email, status)
);

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura a miembros del grupo o al correo invitado" 
ON public.family_invitations FOR SELECT 
TO authenticated
USING (
    family_group_id = (SELECT family_group_id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    OR 
    invited_email = auth.email()
);

CREATE POLICY "Permitir inserción solo a administradores del grupo" 
ON public.family_invitations FOR INSERT 
TO authenticated
WITH CHECK (
    family_group_id = (SELECT family_group_id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    AND 
    (SELECT role FROM public.user_profiles WHERE auth_user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Permitir modificación solo a administradores del grupo" 
ON public.family_invitations FOR ALL
TO authenticated
USING (
    family_group_id = (SELECT family_group_id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    AND 
    (SELECT role FROM public.user_profiles WHERE auth_user_id = auth.uid()) = 'admin'
);
