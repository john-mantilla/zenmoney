-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00017: Add has_rollover to budgets table
--
-- Agrega soporte para el mecanismo de Rollover Presupuestario Configurable.
-- Si has_rollover es true, el superávit/déficit del mes anterior se arrastra.
-- ============================================================================

ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS has_rollover boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.budgets.has_rollover IS 'Indica si el presupuesto acumula el saldo no gastado (superávit) o descuenta el déficit del mes anterior.';
