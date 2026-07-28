-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00012: Immutable Audit Logging System
--
-- Registra automáticamente el historial de cambios (INSERT, UPDATE, DELETE)
-- en transacciones, cuentas, presupuestos y perfiles de usuario vía Triggers de Postgres.
-- ============================================================================

-- 1. CREAR TABLA DE BITÁCORA DE AUDITORÍA
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id  uuid        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    user_id          uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action           text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    entity_type      text        NOT NULL,
    entity_id        uuid        NOT NULL,
    old_data         jsonb,
    new_data         jsonb,
    created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices de consulta rápida por familia y entidad
CREATE INDEX IF NOT EXISTS idx_audit_logs_family ON public.audit_logs (family_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- 2. HABILITAR RLS INMUTABLE
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Los miembros de la familia pueden consultar el historial de su hogar
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
    FOR SELECT
    USING (family_group_id = public.get_user_family_group_id());

-- Estrictamente NO existen políticas de INSERT, UPDATE o DELETE públicas
-- (El trigger se ejecuta con SECURITY DEFINER en la base de datos).

-- 3. FUNCIÓN DE TRIGGER AUTOMÁTICO DE AUDITORÍA
CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_profile_id uuid;
    v_family_group_id uuid;
    v_entity_type text;
    v_entity_id uuid;
    v_old_json jsonb := NULL;
    v_new_json jsonb := NULL;
BEGIN
    v_user_profile_id := public.get_user_profile_id();
    v_entity_type := TG_TABLE_NAME;

    IF (TG_OP = 'DELETE') THEN
        v_entity_id := OLD.id;
        v_family_group_id := OLD.family_group_id;
        v_old_json := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_entity_id := NEW.id;
        v_family_group_id := NEW.family_group_id;
        v_old_json := to_jsonb(OLD);
        v_new_json := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        v_entity_id := NEW.id;
        v_family_group_id := NEW.family_group_id;
        v_new_json := to_jsonb(NEW);
    END IF;

    -- Si por alguna razón la tabla no tiene family_group_id directo (ej: user_profiles)
    IF v_family_group_id IS NULL AND TG_OP != 'DELETE' THEN
        v_family_group_id := NEW.family_group_id;
    END IF;

    IF v_family_group_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (
            family_group_id,
            user_id,
            action,
            entity_type,
            entity_id,
            old_data,
            new_data
        ) VALUES (
            v_family_group_id,
            v_user_profile_id,
            TG_OP,
            v_entity_type,
            v_entity_id,
            v_old_json,
            v_new_json
        );
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. VINCULAR TRIGGERS A LAS TABLAS CRÍTICAS
DROP TRIGGER IF EXISTS audit_transactions_trigger ON public.transactions;
CREATE TRIGGER audit_transactions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_accounts_trigger ON public.accounts;
CREATE TRIGGER audit_accounts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_budgets_trigger ON public.budgets;
CREATE TRIGGER audit_budgets_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_user_profiles_trigger ON public.user_profiles;
CREATE TRIGGER audit_user_profiles_trigger
    AFTER UPDATE OR DELETE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();
