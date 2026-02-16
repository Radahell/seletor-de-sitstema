-- ==========================================
-- MIGRAÇÃO 006: Tenant para o sistema Lances (Câmeras)
-- Data: 2026-02-15
-- Descrição: Cria tenant padrão para o sistema de câmeras
--            para que ele apareça no seletor
-- ==========================================

SET NAMES utf8mb4;

-- ==========================================
-- TENANT: Lance de Ouro (Câmeras)
-- Aponta para o serviço SCL (modulo_2_scl)
-- ==========================================
INSERT INTO tenants (
    system_id, slug, display_name, database_name, database_host,
    primary_color, secondary_color, accent_color,
    welcome_message, is_active, allow_registration, maintenance_mode
)
VALUES (
    (SELECT id FROM systems WHERE slug = 'lances' LIMIT 1),
    'lance-de-ouro',
    'Lance de Ouro',
    'scl_db',
    'varzea-prime-db-1',
    '#8b5cf6',
    '#7c3aed',
    '#a78bfa',
    'Lance de Ouro - Câmeras e gravações dos seus jogos. Assista e compartilhe seus melhores momentos!',
    TRUE,
    TRUE,
    FALSE
)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    primary_color = VALUES(primary_color),
    welcome_message = VALUES(welcome_message),
    is_active = VALUES(is_active);

-- ==========================================
-- Vincular Radael como admin do tenant lances
-- ==========================================
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT
    u.id,
    (SELECT id FROM tenants WHERE slug = 'lance-de-ouro' LIMIT 1),
    'admin',
    TRUE
FROM users u
WHERE u.email = 'radaelivan@gmail.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;
