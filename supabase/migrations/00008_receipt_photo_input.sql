-- ZenMoney — Captura de gastos por foto de recibo (OCR/visión con Gemini)
--
-- Añade 'photo' como input_method para distinguir transacciones creadas
-- a partir de una foto de recibo analizada por Gemini Vision.

ALTER TABLE public.transactions
    DROP CONSTRAINT transactions_input_method_check;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_input_method_check
        CHECK (input_method IN ('manual', 'voice', 'nlq', 'email', 'photo'));
