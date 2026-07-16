-- Migración: 00010_account_privacy.sql
-- Propósito: Implementar privacidad de cuentas y transacciones.
-- 1. Añadir columna is_private a public.accounts.
-- 2. Restringir visibilidad de cuentas privadas solo a sus creadores/dueños en RLS.
-- 3. Permitir ver transacciones solo de las cuentas que son visibles para el usuario.
-- 4. Permitir lectura de todas las transacciones familiares (el enmascaramiento de detalles de transacciones privadas se realiza en el cliente en Mapper.ts).

-- 1. Añadir columna is_private a la tabla de cuentas
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 2. Actualizar política SELECT de accounts para filtrar cuentas privadas
DROP POLICY IF EXISTS accounts_select ON public.accounts;
CREATE POLICY accounts_select ON public.accounts
    FOR SELECT
    TO authenticated
    USING (
        family_group_id = public.get_user_family_group_id()
        AND (
            is_private = false
            OR owner_user_id = public.get_user_profile_id()
        )
    );

-- 3. Actualizar política SELECT de transactions para permitir lectura familiar y vincularla a las cuentas visibles
DROP POLICY IF EXISTS transactions_select ON public.transactions;
CREATE POLICY transactions_select ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        family_group_id = public.get_user_family_group_id()
        AND EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = account_id
        )
    );
