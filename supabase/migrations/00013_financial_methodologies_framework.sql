-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00013: Financial Methodologies Framework (50/30/20, 70/20/10, 60/20/20, FIRE)
--
-- Modela las metodologías de gestión financiera como un framework configurable por el hogar.
-- Agrega además el campo 'budget_role' a las categorías para la clasificación automática universal.
-- ============================================================================

-- 1. AGREGAR COLUMNA BUDGET_ROLE A LA TABLA CATEGORIES
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS budget_role text NOT NULL DEFAULT 'needs'
    CHECK (budget_role IN ('needs', 'wants', 'savings', 'charity', 'income', 'ignore'));

-- Actualizar las categorías sistémicas predeterminadas con sus roles iniciales
UPDATE public.categories SET budget_role = 'needs'   WHERE name IN ('Alimentación', 'Vivienda y Servicios', 'Transporte', 'Salud y Bienestar', 'Educación');
UPDATE public.categories SET budget_role = 'wants'   WHERE name IN ('Entretenimiento y Suscripciones');
UPDATE public.categories SET budget_role = 'savings' WHERE name IN ('Finanzas y Seguros');
UPDATE public.categories SET budget_role = 'income'  WHERE name IN ('Ingresos');
UPDATE public.categories SET budget_role = 'ignore'  WHERE name IN ('Sin clasificar');

-- 2. CREAR TABLA FINANCIAL_METHODOLOGIES
CREATE TABLE IF NOT EXISTS public.financial_methodologies (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id  uuid        REFERENCES public.family_groups(id) ON DELETE CASCADE, -- NULL si es preset sistémico
    name             text        NOT NULL,
    code             text        NOT NULL,
    description      text,
    is_preset        boolean     NOT NULL DEFAULT false,
    targets          jsonb       NOT NULL, -- Ej: {"needs": 50, "wants": 30, "savings": 20}
    is_active        boolean     NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_methodologies_family ON public.financial_methodologies (family_group_id);
CREATE INDEX IF NOT EXISTS idx_methodologies_code ON public.financial_methodologies (code);

-- Habilitar RLS
ALTER TABLE public.financial_methodologies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS methodologies_select ON public.financial_methodologies;
CREATE POLICY methodologies_select ON public.financial_methodologies
    FOR SELECT
    USING (
        is_preset = true
        OR family_group_id = public.get_user_family_group_id()
    );

DROP POLICY IF EXISTS methodologies_insert ON public.financial_methodologies;
CREATE POLICY methodologies_insert ON public.financial_methodologies
    FOR INSERT
    WITH CHECK (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS methodologies_update ON public.financial_methodologies;
CREATE POLICY methodologies_update ON public.financial_methodologies
    FOR UPDATE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() IN ('admin', 'editor')
    );

DROP POLICY IF EXISTS methodologies_delete ON public.financial_methodologies;
CREATE POLICY methodologies_delete ON public.financial_methodologies
    FOR DELETE
    USING (
        family_group_id = public.get_user_family_group_id()
        AND public.get_user_role() = 'admin'
        AND is_preset = false
    );

-- 3. INSERTAR PRESETS SISTÉMICOS DE FÁBRICA
INSERT INTO public.financial_methodologies (name, code, description, is_preset, targets, is_active, family_group_id)
VALUES
    (
        '50/30/20 (Elizabeth Warren)',
        'rule_50_30_20',
        'El balance clásico: 50% Necesidades Básicas, 30% Deseos y Estilo de Vida, 20% Ahorro e Inversión.',
        true,
        '{"needs": 50, "wants": 30, "savings": 20}'::jsonb,
        true,
        NULL
    ),
    (
        '70/20/10 (Mente Millonaria)',
        'rule_70_20_10',
        '70% Gastos de Vida, 20% Ahorro e Inversiones obligado, 10% Caridad y Donaciones.',
        true,
        '{"needs": 70, "savings": 20, "charity": 10}'::jsonb,
        false,
        NULL
    ),
    (
        '60/20/20 (Presupuesto Tradicional)',
        'rule_60_20_20',
        '60% Gastos Fijos y Necesarios, 20% Deseos y Ocio, 20% Ahorro e Inversiones.',
        true,
        '{"needs": 60, "wants": 20, "savings": 20}'::jsonb,
        false,
        NULL
    ),
    (
        'FIRE (Independencia Financiera)',
        'rule_fire',
        'Retiro temprano y agresivo: 50% Gastos de Vida, 50% Ahorro e Inversión acumulativa.',
        true,
        '{"needs": 50, "savings": 50}'::jsonb,
        false,
        NULL
    )
ON CONFLICT DO NOTHING;
