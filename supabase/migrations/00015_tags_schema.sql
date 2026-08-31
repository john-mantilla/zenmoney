-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00015: Tags Schema
--
-- Introduces a system for tagging transactions to support temporary organization,
-- reconciliation states, and custom groupings.
-- ============================================================================

-- 1. Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL DEFAULT '#808080',
    created_at timestamptz DEFAULT now(),
    UNIQUE (family_group_id, name)
);

-- 2. Create transaction_tags relationship table
CREATE TABLE IF NOT EXISTS public.transaction_tags (
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (transaction_id, tag_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_tags_family_group_id ON public.tags(family_group_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_transaction_id ON public.transaction_tags(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON public.transaction_tags(tag_id);

-- 4. Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for tags
CREATE POLICY "Tags are viewable by family members" ON public.tags
    FOR SELECT USING (family_group_id = public.get_user_family_group_id());

CREATE POLICY "Tags can be inserted by editors/admins" ON public.tags
    FOR INSERT WITH CHECK (
        family_group_id = public.get_user_family_group_id() AND 
        public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY "Tags can be updated by editors/admins" ON public.tags
    FOR UPDATE USING (
        family_group_id = public.get_user_family_group_id() AND 
        public.get_user_role() IN ('admin', 'editor')
    );

CREATE POLICY "Tags can be deleted by editors/admins" ON public.tags
    FOR DELETE USING (
        family_group_id = public.get_user_family_group_id() AND 
        public.get_user_role() IN ('admin', 'editor')
    );

-- 6. RLS Policies for transaction_tags
CREATE POLICY "Transaction tags are viewable if user can view transaction" ON public.transaction_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.id = transaction_tags.transaction_id 
            AND t.family_group_id = public.get_user_family_group_id()
        )
    );

CREATE POLICY "Transaction tags can be managed by editors/admins" ON public.transaction_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.id = transaction_tags.transaction_id 
            AND t.family_group_id = public.get_user_family_group_id()
        ) AND 
        public.get_user_role() IN ('admin', 'editor')
    );
