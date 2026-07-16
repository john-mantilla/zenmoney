-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00007: Assistant Conversational Memory
--
-- Persiste el historial de conversación del asistente IA por usuario, para que
-- recuerde el contexto entre preguntas (memoria dentro de la sesión) y entre
-- aperturas de la app (memoria entre sesiones). Es un hilo personal, no
-- compartido con el resto de la familia.
-- ============================================================================

CREATE TABLE public.assistant_messages (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id    uuid        NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    user_id            uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    sender             text        NOT NULL CHECK (sender IN ('user', 'ai')),
    content            text        NOT NULL,
    suggested_actions  jsonb       NOT NULL DEFAULT '[]'::jsonb,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_messages_user_created ON public.assistant_messages (user_id, created_at);

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede ver y escribir su propio hilo de conversación —
-- ni siquiera el resto de la familia lo ve (a diferencia de casi todo lo demás en la app).
CREATE POLICY assistant_messages_select ON public.assistant_messages
    FOR SELECT
    USING (user_id = public.get_user_profile_id());

CREATE POLICY assistant_messages_insert ON public.assistant_messages
    FOR INSERT
    WITH CHECK (
        user_id = public.get_user_profile_id()
        AND family_group_id = public.get_user_family_group_id()
    );

CREATE POLICY assistant_messages_delete ON public.assistant_messages
    FOR DELETE
    USING (user_id = public.get_user_profile_id());
