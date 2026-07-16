-- ============================================================================
-- ZenMoney - Personal & Family Finance App
-- Migration 00003: Seed System Categories
--
-- Inserts 21 default system categories available to all users regardless of
-- family group. These categories use Material Design icon names and a
-- curated color palette optimised for the Colombian market.
--
-- System categories have:
--   is_system        = true
--   family_group_id  = NULL  (visible to everyone via RLS policy)
-- ============================================================================

INSERT INTO public.categories (name, icon, color, is_system, family_group_id) VALUES

    ('Alimentación',                  'cart',                '#4CAF50',  true, NULL),
    ('Vivienda y Servicios',          'home',                '#795548',  true, NULL),
    ('Transporte',                    'car',                 '#2196F3',  true, NULL),
    ('Salud y Bienestar',             'hospital-box',        '#F44336',  true, NULL),
    ('Entretenimiento y Suscripciones', 'movie',             '#E91E63',  true, NULL),
    ('Educación',                     'school',              '#3F51B5',  true, NULL),
    ('Finanzas y Seguros',            'shield-check',        '#00BCD4',  true, NULL),
    ('Ingresos',                      'cash',                '#2E7D5F',  true, NULL),
    ('Sin clasificar',                'help-circle',         '#9E9E9E',  true, NULL);
