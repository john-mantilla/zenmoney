-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00018: Add budget rollover and budget override support
-- ============================================================================

-- 1. Rollover Presupuestario
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS has_rollover boolean NOT NULL DEFAULT false;

-- 2. Anulación Específica (Budget Override)
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS is_override boolean NOT NULL DEFAULT false;

ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS override_reason text NULL;

COMMENT ON COLUMN public.budgets.has_rollover IS 'Indica si acumula el saldo o descuenta el déficit del mes anterior.';
COMMENT ON COLUMN public.budgets.is_override IS 'Indica si es un límite extraordinario puntual de 1 solo mes que no altera la regla maestra.';
COMMENT ON COLUMN public.budgets.override_reason IS 'Motivo opcional del ajuste extraordinario (ej. Navidad, Vacaciones).';
