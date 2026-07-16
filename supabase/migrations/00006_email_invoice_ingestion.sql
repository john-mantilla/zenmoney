-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00006: Email Invoice Ingestion (Factura Electrónica DIAN)
--
-- Adds a per-family unique inbound token so incoming emails forwarded to
-- {token}@<inbound-domain> can be routed to the right family_group_id by the
-- parse-dian-invoice Edge Function, and a new 'email' input_method so those
-- auto-created transactions are distinguishable in the UI.
-- ============================================================================

ALTER TABLE public.family_groups
    ADD COLUMN inbound_token text UNIQUE NOT NULL
        DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

COMMENT ON COLUMN public.family_groups.inbound_token IS
    'Opaque token used as the local-part of the family''s e-invoice forwarding address (token@<inbound-domain>).';

ALTER TABLE public.transactions
    DROP CONSTRAINT transactions_input_method_check;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_input_method_check
        CHECK (input_method IN ('manual', 'voice', 'nlq', 'email'));
