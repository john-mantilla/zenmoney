-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00019: Escalabilidad Histórica - Índices y current_balance
-- ============================================================================

-- 1. Agregar columna de saldo consolidado atómico en cuentas
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS current_balance numeric(15,2) DEFAULT NULL;

COMMENT ON COLUMN public.accounts.current_balance IS 'Saldo consolidado actual de la cuenta para lecturas O(1) instantáneas.';

-- 2. Índices B-Tree de alto rendimiento para consultas históricas masivas
CREATE INDEX IF NOT EXISTS idx_transactions_account_status 
  ON public.transactions(account_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_status 
  ON public.transactions(transfer_to_account_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_date 
  ON public.transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_transactions_updated_at 
  ON public.transactions(updated_at);

CREATE INDEX IF NOT EXISTS idx_transactions_family_status 
  ON public.transactions(family_group_id, status);

-- 3. Función RPC para consolidación de saldos en motor PostgreSQL
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(p_account_id uuid)
RETURNS numeric(15,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type text;
  v_initial numeric(15,2);
  v_delta numeric(15,2);
  v_result numeric(15,2);
BEGIN
  SELECT type, initial_balance INTO v_type, v_initial
  FROM public.accounts
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_type IN ('credit_card', 'loan', 'mortgage') THEN
    -- Cuentas de deuda: gastos aumentan deuda, ingresos y transferencias entrantes disminuyen deuda
    SELECT COALESCE(SUM(
      CASE 
        WHEN type = 'expense' THEN amount
        WHEN type = 'income' THEN -amount
        WHEN type = 'transfer' AND transfer_to_account_id = p_account_id THEN -amount
        WHEN type = 'transfer' AND account_id = p_account_id THEN amount
        ELSE 0
      END
    ), 0) INTO v_delta
    FROM public.transactions
    WHERE status = 'confirmed' AND (account_id = p_account_id OR transfer_to_account_id = p_account_id);
  ELSE
    -- Cuentas estándar: ingresos aumentan disponible, gastos y transferencias salientes disminuyen disponible
    SELECT COALESCE(SUM(
      CASE 
        WHEN type = 'income' THEN amount
        WHEN type = 'expense' THEN -amount
        WHEN type = 'transfer' AND account_id = p_account_id THEN -amount
        WHEN type = 'transfer' AND transfer_to_account_id = p_account_id THEN amount
        ELSE 0
      END
    ), 0) INTO v_delta
    FROM public.transactions
    WHERE status = 'confirmed' AND (account_id = p_account_id OR transfer_to_account_id = p_account_id);
  END IF;

  v_result := v_initial + v_delta;

  UPDATE public.accounts
  SET current_balance = v_result
  WHERE id = p_account_id;

  RETURN v_result;
END;
$$;
