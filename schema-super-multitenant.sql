-- ==========================================
-- BANCO DE CONFIGURAÇÕES - SUPER MULTI-TENANT
-- Suporta múltiplos sistemas (Jogador, Quadra, etc)
-- ==========================================

CREATE DATABASE IF NOT EXISTS varzeaprime_config;
USE varzeaprime_config;

-- ==========================================
-- TABELA DE SISTEMAS (Apps)
-- ==========================================
CREATE TABLE systems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Identificação
    slug VARCHAR(50) UNIQUE NOT NULL COMMENT 'jogador, quadra, arbitro',
    display_name VARCHAR(100) NOT NULL COMMENT 'Sistema de Jogadores, Gestão de Quadras',
    description TEXT COMMENT 'Descrição do sistema',
    
    -- Visual
    icon VARCHAR(100) COMMENT 'Ícone: trophy, building, whistle',
    color VARCHAR(7) DEFAULT '#ef4444' COMMENT 'Cor do card',
    
    -- Configuração
    base_route VARCHAR(100) COMMENT 'Rota base: /jogador, /quadra',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ordem de exibição
    display_order INT DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_slug (slug),
    INDEX idx_active (is_active),
    INDEX idx_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- TABELA DE TENANTS (Instâncias de cada sistema)
-- ==========================================
CREATE TABLE tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Relacionamento
    system_id INT NOT NULL COMMENT 'ID do sistema (jogador, quadra, etc)',
    
    -- Identificação
    slug VARCHAR(50) UNIQUE NOT NULL COMMENT 'URL-friendly: copa-brahma, arena-sport',
    display_name VARCHAR(100) NOT NULL COMMENT 'Nome para exibição',
    
    -- Banco de dados
    database_name VARCHAR(64) NOT NULL COMMENT 'Nome real do DB',
    database_host VARCHAR(255) DEFAULT 'db' COMMENT 'Host do MySQL',
    
    -- Branding
    logo_url VARCHAR(255) COMMENT 'URL do logo',
    favicon_url VARCHAR(255) COMMENT 'Favicon customizado',
    
    -- Cores (Paleta)
    primary_color VARCHAR(7) DEFAULT '#ef4444',
    secondary_color VARCHAR(7) DEFAULT '#f59e0b',
    accent_color VARCHAR(7) DEFAULT '#3b82f6',
    background_color VARCHAR(7) DEFAULT '#09090b',
    
    -- Textos customizados
    welcome_message TEXT,
    footer_text VARCHAR(255),
    
    -- Endereço (para quadras)
    address TEXT COMMENT 'Endereço completo',
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),
    
    -- Configurações
    allow_registration BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
    INDEX idx_slug (slug),
    INDEX idx_system (system_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- TABELA DE FEATURES (módulos por tenant)
-- ==========================================
CREATE TABLE tenant_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    
    feature_name VARCHAR(50) NOT NULL COMMENT 'ranking, reservas, pagamentos',
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSON,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_feature (tenant_id, feature_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- DADOS DE EXEMPLO
-- ==========================================

-- Inserir sistemas
INSERT INTO systems (slug, display_name, description, icon, color, base_route, display_order) VALUES 
('jogador', 'Sistema de Jogadores', 'Gestão de campeonatos e jogadores', 'trophy', '#ef4444', '/jogador', 1),
('quadra', 'Gestão de Quadras', 'Reservas e gestão de espaços esportivos', 'building', '#3b82f6', '/quadra', 2),
('arbitro', 'Portal do Árbitro', 'Escalas e gestão de arbitragem', 'whistle', '#f59e0b', '/arbitro', 3);

-- ==========================================
-- SISTEMA DE JOGADORES - Tenants (Campeonatos)
-- ==========================================
INSERT INTO tenants (
    system_id,
    slug, 
    display_name, 
    database_name,
    primary_color,
    secondary_color,
    accent_color,
    welcome_message
) VALUES 
-- Sistema Jogador (ID 1)
(
    1,  -- jogador
    'copa-brahma',
    'Copa Brahma',
    'copa_brahma_db',
    '#FFD700',
    '#000000',
    '#FFFFFF',
    'Bem-vindo à Copa Brahma - O melhor futebol amador!'
),
(
    1,  -- jogador
    'copa-aposentados',
    'Copa AposentadoS',
    'copa_aposentados',
    '#ef4444',
    '#f59e0b',
    '#3b82f6',
    'Bem-vindo à Copa AposentadoS - Experiência em campo!'
),
(
    1,  -- jogador
    'liga-ouro',
    'Liga Ouro',
    'liga_ouro_db',
    '#F4C430',
    '#C0C0C0',
    '#CD7F32',
    'Bem-vindo à Liga Ouro - Onde campeões são forjados!'
);

-- ==========================================
-- SISTEMA DE QUADRAS - Tenants (Estabelecimentos)
-- ==========================================
INSERT INTO tenants (
    system_id,
    slug,
    display_name,
    database_name,
    primary_color,
    secondary_color,
    welcome_message,
    address,
    city,
    state,
    zip_code,
    phone,
    email
) VALUES
-- Sistema Quadra (ID 2)
(
    2,  -- quadra
    'arena-sport',
    'Arena Sport Center',
    'arena_sport_db',
    '#10b981',
    '#059669',
    'Bem-vindo à Arena Sport - Reserve sua quadra!',
    'Rua do Esporte, 123 - Centro',
    'São Paulo',
    'SP',
    '01234-567',
    '(11) 98765-4321',
    'contato@arenasport.com.br'
),
(
    2,  -- quadra
    'society-club',
    'Society Club',
    'society_club_db',
    '#8b5cf6',
    '#7c3aed',
    'Society Club - A melhor infraestrutura para seu jogo',
    'Av. Principal, 456 - Jardim',
    'Campo Grande',
    'MS',
    '79000-000',
    '(67) 99876-5432',
    'reservas@societyclub.com.br'
);

-- ==========================================
-- FEATURES POR TENANT
-- ==========================================

-- Copa Brahma (jogador)
INSERT INTO tenant_features (tenant_id, feature_name, is_enabled, config) VALUES
(1, 'ranking', TRUE, '{"show_photos": true, "items_per_page": 20}'),
(1, 'statistics', TRUE, '{"show_advanced": false}'),
(1, 'photos', TRUE, '{"max_size_mb": 5}'),
(1, 'cards', TRUE, '{"enable_fifa_cards": true}');

-- Copa AposentadoS (jogador)
INSERT INTO tenant_features (tenant_id, feature_name, is_enabled, config) VALUES
(2, 'ranking', TRUE, '{"show_photos": true, "items_per_page": 50}'),
(2, 'statistics', TRUE, '{"show_advanced": true}'),
(2, 'photos', TRUE, '{"max_size_mb": 10}'),
(2, 'cards', TRUE, '{"enable_fifa_cards": true}');

-- Arena Sport (quadra)
INSERT INTO tenant_features (tenant_id, feature_name, is_enabled, config) VALUES
(4, 'reservas', TRUE, '{"min_hours": 1, "max_days_advance": 30}'),
(4, 'pagamentos', TRUE, '{"accept_pix": true, "accept_card": true}'),
(4, 'calendario', TRUE, '{"show_availability": true}');

-- Society Club (quadra)
INSERT INTO tenant_features (tenant_id, feature_name, is_enabled, config) VALUES
(5, 'reservas', TRUE, '{"min_hours": 2, "max_days_advance": 15}'),
(5, 'pagamentos', TRUE, '{"accept_pix": true}'),
(5, 'calendario', TRUE, '{"show_availability": true}'),
(5, 'lanchonete', TRUE, '{"enable_orders": true}');

-- ==========================================
-- VIEWS ÚTEIS
-- ==========================================

-- View de todos os sistemas com contagem de tenants
CREATE VIEW systems_overview AS
SELECT 
    s.id,
    s.slug,
    s.display_name,
    s.icon,
    s.color,
    s.is_active,
    COUNT(t.id) as total_tenants,
    COUNT(CASE WHEN t.is_active = TRUE THEN 1 END) as active_tenants
FROM systems s
LEFT JOIN tenants t ON s.id = t.system_id
GROUP BY s.id
ORDER BY s.display_order;

-- View de tenants com info do sistema
CREATE VIEW tenants_full AS
SELECT 
    t.id,
    t.slug,
    t.display_name,
    t.database_name,
    t.primary_color,
    t.is_active,
    t.maintenance_mode,
    s.slug as system_slug,
    s.display_name as system_name,
    s.icon as system_icon,
    s.color as system_color
FROM tenants t
INNER JOIN systems s ON t.system_id = s.id;
