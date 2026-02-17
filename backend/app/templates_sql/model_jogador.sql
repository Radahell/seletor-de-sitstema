-- =================================================================
-- TEMPLATE: SISTEMA DE JOGADOR (CAMPEONATO)
-- Versao: 3.0 (2026-02-17 — completo, alinhado com banco real)
-- Usado pelo Admin Global para provisionar novos tenants de campeonato
-- =================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =================================================================
-- 1. TABELAS INDEPENDENTES
-- =================================================================

CREATE TABLE IF NOT EXISTS frames (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_path VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blocked_identities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255),
    name VARCHAR(255),
    nickname VARCHAR(255),
    phone VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_blocked_email (email),
    INDEX idx_blocked_name (name),
    INDEX idx_blocked_phone (phone),
    INDEX idx_blocked_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seasons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- 2. USUARIOS (User + Player unificados)
-- =================================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    is_approved TINYINT(1) NOT NULL DEFAULT 0,
    is_blocked TINYINT(1) NOT NULL DEFAULT 0,
    is_monthly TINYINT(1) NOT NULL DEFAULT 0,
    name VARCHAR(255),
    nickname VARCHAR(255),
    phone VARCHAR(50),
    cpf VARCHAR(14),
    city VARCHAR(100),
    state VARCHAR(2),
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    selected_frame VARCHAR(50) DEFAULT 'gold',
    photo VARCHAR(512),
    preferred_position VARCHAR(100),
    skill_rating FLOAT NOT NULL DEFAULT 0.0,
    fk_id_user_hub INT NULL,

    UNIQUE KEY ix_users_email (email),
    UNIQUE KEY uq_fk_id_user_hub (fk_id_user_hub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id INT,
    details VARCHAR(1000),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY (user_id),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS finance_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_type ENUM('expense', 'sponsorship', 'income') NOT NULL,
    amount FLOAT NOT NULL DEFAULT 0.0,
    description VARCHAR(255),
    entry_date DATE NOT NULL,
    created_by INT,
    receipt_path LONGTEXT,
    affects_cash TINYINT(1) NOT NULL DEFAULT 1,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- 3. NOTIFICACOES E PUSH
-- =================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel ENUM('web', 'app', 'both') NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY ix_notification_templates_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_trigger_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(120) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    event_kind ENUM('event', 'schedule', 'manual') NOT NULL,
    default_config JSON,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY ix_notification_trigger_types_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_automation_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    template_id INT NOT NULL,
    trigger_type_id INT NOT NULL,
    audience ENUM('all_active_users', 'event_user', 'specific_user', 'custom_users') NOT NULL,
    config JSON,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY ix_notification_automation_rules_slug (slug),
    INDEX ix_notification_automation_rules_name (name),
    FOREIGN KEY (template_id) REFERENCES notification_templates(id),
    FOREIGN KEY (trigger_type_id) REFERENCES notification_trigger_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    status ENUM('unread', 'read', 'pending', 'accepted', 'declined') NOT NULL DEFAULT 'unread',
    read_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX ix_notifications_type (type),
    INDEX ix_notifications_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    platform VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY ix_push_tokens_token (token),
    INDEX ix_push_tokens_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- 4. REGRAS E ESTRUTURA DE JOGO
-- =================================================================

CREATE TABLE IF NOT EXISTS scoring_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    value INT NOT NULL,
    category ENUM('technical', 'administrative', 'match', 'disciplinary') NOT NULL,
    applies_to ENUM('player', 'team', 'match', 'goalkeeper'),
    evaluation_scope ENUM('DAY', 'MATCH', 'EVENT') NOT NULL DEFAULT 'MATCH',
    max_applications INT,
    max_per_match INT,
    is_stackable TINYINT(1) NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    apply_conditions JSON,
    identifier VARCHAR(50),
    description VARCHAR(255),
    balance_weight FLOAT DEFAULT 1.0,
    is_system_standard TINYINT(1) DEFAULT 0,
    score_destination ENUM('individual', 'championship', 'both', 'counter_individual', 'counter_championship', 'counter_both') DEFAULT 'both',
    shadow_tier ENUM('primary', 'secondary', 'none') NOT NULL DEFAULT 'none',

    INDEX idx_scoring_rules_identifier (identifier),
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    game_day DATE,
    game_time TIME,
    game_date DATETIME,
    status ENUM('planned', 'in_progress', 'break', 'finished') NOT NULL DEFAULT 'planned',
    number_of_teams INT NOT NULL DEFAULT 2,
    players_per_team INT NOT NULL DEFAULT 6,
    planned_matches INT NOT NULL DEFAULT 0,
    signup_goalkeepers_limit INT NOT NULL DEFAULT 4,
    signup_players_limit INT NOT NULL DEFAULT 16,
    signup_reserves_limit INT NOT NULL DEFAULT 4,

    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    day_id INT,
    match_day DATE NOT NULL,
    match_time TIME NOT NULL DEFAULT '20:00:00',
    status ENUM('scheduled', 'finished') NOT NULL DEFAULT 'scheduled',

    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- 5. VINCULOS DE JOGO (Times, Escalacoes)
-- =================================================================

CREATE TABLE IF NOT EXISTS game_day_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_id INT NOT NULL,
    player_id INT NOT NULL,
    team VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    is_substitute TINYINT(1) DEFAULT 0,
    replaced_player_id INT,

    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (replaced_player_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS match_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    player_id INT NOT NULL,
    team VARCHAR(10),
    is_goalkeeper TINYINT(1) DEFAULT 0,
    count_points TINYINT(1) DEFAULT 1,

    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS match_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT,
    day_id INT,
    player_id INT,
    rule_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    timestamp DATETIME NOT NULL,
    created_by INT NOT NULL,
    context JSON,

    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES scoring_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- 6. FINANCEIRO, INSCRICOES E MENSALIDADES
-- =================================================================

CREATE TABLE IF NOT EXISTS game_day_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_id INT NOT NULL,
    user_id INT NOT NULL,
    amount FLOAT NOT NULL DEFAULT 0.0,
    status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
    payment_type ENUM('monthly', 'single') NOT NULL DEFAULT 'single',
    paid_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    receipt_path VARCHAR(512),

    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_day_signups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    slot_type ENUM('goalkeeper', 'player', 'reserve') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY game_day_signups_day_user_unique (day_id, user_id),
    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS match_signups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    slot_type ENUM('goalkeeper', 'player', 'reserve') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY match_signups_match_user_unique (match_id, user_id),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS monthly_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    user_id INT NOT NULL,
    month DATE NOT NULL,
    amount FLOAT NOT NULL,
    status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
    receipt_path VARCHAR(512),
    paid_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_monthly_payments (season_id, user_id, month),
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS season_monthly_memberships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    user_id INT NOT NULL,
    is_monthly TINYINT(1) NOT NULL DEFAULT 0,

    UNIQUE KEY uq_season_monthly_memberships (season_id, user_id),
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =================================================================
-- 7. DIVERSOS E ESTATISTICAS
-- =================================================================

CREATE TABLE IF NOT EXISTS game_day_exceptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_id INT NOT NULL,
    match_id INT,
    removed_player_id INT,
    reason VARCHAR(255) NOT NULL,
    context JSON,
    suggestions JSON,
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (removed_player_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS player_season_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    season_id INT NOT NULL,
    total_points INT NOT NULL DEFAULT 0,
    matches_played INT NOT NULL DEFAULT 0,
    last_updated DATETIME NOT NULL,

    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CHECK (total_points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- FIM DO TEMPLATE JOGADOR (24 tabelas)
