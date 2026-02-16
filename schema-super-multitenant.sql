-- ==========================================
-- SELETOR: BANCO MASTER DE CONFIGURAÇÕES
-- (systems / tenants / super_admins / tenant_features)
--
-- ATENÇÃO:
-- - NÃO crie database aqui
-- - NÃO use USE aqui
-- Esse arquivo é executado dentro do banco definido por MYSQL_DATABASE
-- ==========================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==========================================
-- TABELA: systems
-- ==========================================
CREATE TABLE IF NOT EXISTS systems (
    id INT AUTO_INCREMENT PRIMARY KEY,

    slug VARCHAR(50) UNIQUE NOT NULL COMMENT 'jogador, quadra, arbitro',
    display_name VARCHAR(100) NOT NULL COMMENT 'Sistema de Jogadores, Gestão de Quadras',
    description TEXT COMMENT 'Descrição do sistema',

    icon VARCHAR(100) COMMENT 'Ícone: trophy, building, whistle',
    color VARCHAR(7) DEFAULT '#ef4444' COMMENT 'Cor do card',

    base_route VARCHAR(100) COMMENT 'Rota base: /jogador, /quadra',
    is_active BOOLEAN DEFAULT TRUE,

    display_order INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_slug (slug),
    INDEX idx_active (is_active),
    INDEX idx_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- TABELA: tenants
-- ==========================================
CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,

    system_id INT NOT NULL COMMENT 'ID do sistema (jogador, quadra, etc)',

    slug VARCHAR(50) UNIQUE NOT NULL COMMENT 'URL-friendly: copa-brahma, arena-sport',
    display_name VARCHAR(100) NOT NULL COMMENT 'Nome para exibição',

    database_name VARCHAR(64) NOT NULL COMMENT 'Nome real do DB (onde app roda)',
    database_host VARCHAR(255) DEFAULT 'db' COMMENT 'Host do MySQL do app (ex: varzea-prime-db)',

    logo_url VARCHAR(255) COMMENT 'URL do logo',
    favicon_url VARCHAR(255) COMMENT 'Favicon customizado',

    primary_color VARCHAR(7) DEFAULT '#ef4444',
    secondary_color VARCHAR(7) DEFAULT '#f59e0b',
    accent_color VARCHAR(7) DEFAULT '#3b82f6',
    background_color VARCHAR(7) DEFAULT '#09090b',

    welcome_message TEXT,
    footer_text VARCHAR(255),

    address TEXT COMMENT 'Endereço completo',
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),

    allow_registration BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    maintenance_mode BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tenants_system
      FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,

    INDEX idx_slug (slug),
    INDEX idx_system (system_id),
    INDEX idx_active (is_active),
    INDEX idx_maintenance (maintenance_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- TABELA: tenant_features
-- ==========================================
CREATE TABLE IF NOT EXISTS tenant_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,

    feature_name VARCHAR(50) NOT NULL COMMENT 'ranking, reservas, pagamentos',
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSON,

    CONSTRAINT fk_tenant_features_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    UNIQUE KEY unique_tenant_feature (tenant_id, feature_name),
    INDEX idx_feature (feature_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- TABELA: super_admins
-- (o seu backend usa /api/super-admin/login)
-- ==========================================
CREATE TABLE IF NOT EXISTS super_admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uniq_super_admins_email (email),
    INDEX idx_super_admins_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- SEED: systems (idempotente)
-- ==========================================
INSERT INTO systems (slug, display_name, description, icon, color, base_route, display_order, is_active)
VALUES
('jogador', 'Sistema de Jogadores', 'Gestão de campeonatos e jogadores', 'trophy',  '#ef4444', '/jogador', 1, TRUE),
('quadra',  'Gestão de Quadras',      'Reservas e gestão de espaços esportivos', 'building', '#3b82f6', '/quadra',  2, TRUE),
('arbitro', 'Portal do Árbitro',      'Escalas e gestão de arbitragem', 'whistle', '#f59e0b', '/arbitro', 3, TRUE)
ON DUPLICATE KEY UPDATE
display_name = VALUES(display_name),
description  = VALUES(description),
icon         = VALUES(icon),
color        = VALUES(color),
base_route   = VALUES(base_route),
display_order= VALUES(display_order),
is_active    = VALUES(is_active);

-- ==========================================
-- SEED: tenants (idempotente, sem depender de IDs)
-- IMPORTANTE:
-- database_host aqui deve apontar para o MySQL do VARZEA onde os tenants existem.
-- Se seu padrão é varzea-prime-db, já deixei setado.
-- ==========================================
INSERT INTO tenants (
  system_id, slug, display_name, database_name, database_host,
  primary_color, secondary_color, accent_color, welcome_message,
  is_active, allow_registration, maintenance_mode
)
VALUES
(
  (SELECT id FROM systems WHERE slug='jogador' LIMIT 1),
  'copa-brahma', 'Copa Brahma', 'copa_brahma_db', 'varzea-prime-db',
  '#FFD700', '#000000', '#FFFFFF', 'Bem-vindo à Copa Brahma - O melhor futebol amador!',
  TRUE, TRUE, FALSE
),
(
  (SELECT id FROM systems WHERE slug='jogador' LIMIT 1),
  'copa-aposentados', 'Copa AposentadoS', 'copa_aposentados', 'varzea-prime-db',
  '#ef4444', '#f59e0b', '#3b82f6', 'Bem-vindo à Copa AposentadoS - Experiência em campo!',
  TRUE, TRUE, FALSE
),
(
  (SELECT id FROM systems WHERE slug='jogador' LIMIT 1),
  'liga-ouro', 'Liga Ouro', 'liga_ouro_db', 'varzea-prime-db',
  '#F4C430', '#C0C0C0', '#CD7F32', 'Bem-vindo à Liga Ouro - Onde campeões são forjados!',
  TRUE, TRUE, FALSE
),
(
  (SELECT id FROM systems WHERE slug='quadra' LIMIT 1),
  'arena-sport', 'Arena Sport Center', 'arena_sport_db', 'varzea-prime-db',
  '#10b981', '#059669', '#3b82f6', 'Bem-vindo à Arena Sport - Reserve sua quadra!',
  TRUE, TRUE, FALSE
),
(
  (SELECT id FROM systems WHERE slug='quadra' LIMIT 1),
  'society-club', 'Society Club', 'society_club_db', 'varzea-prime-db',
  '#8b5cf6', '#7c3aed', '#3b82f6', 'Society Club - A melhor infraestrutura para seu jogo',
  TRUE, TRUE, FALSE
)
ON DUPLICATE KEY UPDATE
display_name       = VALUES(display_name),
database_name      = VALUES(database_name),
database_host      = VALUES(database_host),
primary_color      = VALUES(primary_color),
secondary_color    = VALUES(secondary_color),
accent_color       = VALUES(accent_color),
welcome_message    = VALUES(welcome_message),
is_active          = VALUES(is_active),
allow_registration = VALUES(allow_registration),
maintenance_mode   = VALUES(maintenance_mode);

-- Ajusta os detalhes “quadra” (endereço etc) de forma idempotente
UPDATE tenants
SET
  address = 'Rua do Esporte, 123 - Centro',
  city    = 'São Paulo',
  state   = 'SP',
  zip_code= '01234-567',
  phone   = '(11) 98765-4321',
  email   = 'contato@arenasport.com.br'
WHERE slug = 'arena-sport';

UPDATE tenants
SET
  address = 'Av. Principal, 456 - Jardim',
  city    = 'Campo Grande',
  state   = 'MS',
  zip_code= '79000-000',
  phone   = '(67) 99876-5432',
  email   = 'reservas@societyclub.com.br'
WHERE slug = 'society-club';

-- ==========================================
-- SEED: tenant_features (idempotente, por slug)
-- ==========================================
INSERT INTO tenant_features (tenant_id, feature_name, is_enabled, config)
VALUES
((SELECT id FROM tenants WHERE slug='copa-brahma' LIMIT 1), 'ranking', TRUE, '{"show_photos": true, "items_per_page": 20}'),
((SELECT id FROM tenants WHERE slug='copa-brahma' LIMIT 1), 'statistics', TRUE, '{"show_advanced": false}'),
((SELECT id FROM tenants WHERE slug='copa-brahma' LIMIT 1), 'photos', TRUE, '{"max_size_mb": 5}'),
((SELECT id FROM tenants WHERE slug='copa-brahma' LIMIT 1), 'cards', TRUE, '{"enable_fifa_cards": true}'),

((SELECT id FROM tenants WHERE slug='copa-aposentados' LIMIT 1), 'ranking', TRUE, '{"show_photos": true, "items_per_page": 50}'),
((SELECT id FROM tenants WHERE slug='copa-aposentados' LIMIT 1), 'statistics', TRUE, '{"show_advanced": true}'),
((SELECT id FROM tenants WHERE slug='copa-aposentados' LIMIT 1), 'photos', TRUE, '{"max_size_mb": 10}'),
((SELECT id FROM tenants WHERE slug='copa-aposentados' LIMIT 1), 'cards', TRUE, '{"enable_fifa_cards": true}'),

((SELECT id FROM tenants WHERE slug='arena-sport' LIMIT 1), 'reservas', TRUE, '{"min_hours": 1, "max_days_advance": 30}'),
((SELECT id FROM tenants WHERE slug='arena-sport' LIMIT 1), 'pagamentos', TRUE, '{"accept_pix": true, "accept_card": true}'),
((SELECT id FROM tenants WHERE slug='arena-sport' LIMIT 1), 'calendario', TRUE, '{"show_availability": true}'),

((SELECT id FROM tenants WHERE slug='society-club' LIMIT 1), 'reservas', TRUE, '{"min_hours": 2, "max_days_advance": 15}'),
((SELECT id FROM tenants WHERE slug='society-club' LIMIT 1), 'pagamentos', TRUE, '{"accept_pix": true}'),
((SELECT id FROM tenants WHERE slug='society-club' LIMIT 1), 'calendario', TRUE, '{"show_availability": true}'),
((SELECT id FROM tenants WHERE slug='society-club' LIMIT 1), 'lanchonete', TRUE, '{"enable_orders": true}')
ON DUPLICATE KEY UPDATE
is_enabled = VALUES(is_enabled),
config      = VALUES(config);

-- ==========================================
-- VIEWS ÚTEIS
-- ==========================================
CREATE OR REPLACE VIEW systems_overview AS
SELECT
  s.id,
  s.slug,
  s.display_name,
  s.icon,
  s.color,
  s.is_active,
  COUNT(t.id) AS total_tenants,
  SUM(CASE WHEN t.is_active = TRUE THEN 1 ELSE 0 END) AS active_tenants
FROM systems s
LEFT JOIN tenants t ON s.id = t.system_id
GROUP BY s.id
ORDER BY s.display_order;

CREATE OR REPLACE VIEW tenants_full AS
SELECT
  t.id,
  t.slug,
  t.display_name,
  t.database_name,
  t.database_host,
  t.primary_color,
  t.is_active,
  t.maintenance_mode,
  s.slug AS system_slug,
  s.display_name AS system_name,
  s.icon AS system_icon,
  s.color AS system_color
FROM tenants t
INNER JOIN systems s ON t.system_id = s.id;
