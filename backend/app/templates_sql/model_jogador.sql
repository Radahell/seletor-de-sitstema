-- =================================================================
-- TEMPLATE: SISTEMA DE JOGADOR (CAMPEONATO)
-- Versao: 2.0 (pos-merge User+Player)
-- =================================================================

-- 1. TABELAS INDEPENDENTES (Sem Foreign Keys iniciais)
-- =================================================================

CREATE TABLE IF NOT EXISTS frames (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_path VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS blocked_identities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255),
    name VARCHAR(255),
    nickname VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_blocked_email (email)
);

CREATE TABLE IF NOT EXISTS seasons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active TINYINT(1) DEFAULT 0
);

-- =================================================================
-- 2. USUARIOS (User + Player unificados)
-- =================================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_admin TINYINT(1) DEFAULT 0,
    is_approved TINYINT(1) DEFAULT 0,
    is_blocked TINYINT(1) DEFAULT 0,
    is_monthly TINYINT(1) DEFAULT 0,
    name VARCHAR(255),
    nickname VARCHAR(255),
    phone VARCHAR(50),
    cpf VARCHAR(14),
    photo VARCHAR(512),
    preferred_position VARCHAR(100),
    skill_rating FLOAT DEFAULT 0.0,
    fk_id_user_hub INT NULL UNIQUE,

    INDEX idx_email (email),
    INDEX idx_cpf (cpf),
    INDEX idx_fk_user_hub (fk_id_user_hub)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id INT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS finance_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_type ENUM('expense', 'sponsorship', 'income') NOT NULL,
    amount FLOAT DEFAULT 0.0,
    description VARCHAR(255),
    entry_date DATE NOT NULL,
    created_by INT,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =================================================================
-- 3. REGRAS E ESTRUTURA DE JOGO (Depende de Seasons)
-- =================================================================

CREATE TABLE IF NOT EXISTS scoring_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(50),
    description VARCHAR(255),
    shadow_tier ENUM('primary', 'secondary', 'none') DEFAULT 'none',
    balance_weight FLOAT DEFAULT 0.0,
    is_system_standard TINYINT(1) DEFAULT 0,
    score_destination ENUM('individual', 'championship', 'both') DEFAULT 'both',
    value INT NOT NULL,
    category ENUM('technical', 'administrative', 'match', 'disciplinary') NOT NULL,
    applies_to ENUM('player', 'team', 'match', 'goalkeeper') NOT NULL,
    evaluation_scope ENUM('DAY', 'MATCH', 'EVENT') DEFAULT 'MATCH',
    max_applications INT,
    max_per_match INT,
    is_stackable TINYINT(1) DEFAULT 1,
    is_active TINYINT(1) DEFAULT 1,
    apply_conditions JSON,

    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    INDEX idx_rule_identifier (identifier)
);

CREATE TABLE IF NOT EXISTS game_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    game_day DATE NOT NULL,
    game_time TIME NOT NULL,
    game_date DATETIME,
    status ENUM('planned', 'in_progress', 'break', 'finished') DEFAULT 'planned',
    number_of_teams INT DEFAULT 2,
    players_per_team INT DEFAULT 6,
    planned_matches INT DEFAULT 0,
    signup_goalkeepers_limit INT DEFAULT 4,
    signup_players_limit INT DEFAULT 16,
    signup_reserves_limit INT DEFAULT 4,

    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    day_id INT NOT NULL,
    match_day DATE NOT NULL,
    match_time TIME NOT NULL,
    status ENUM('scheduled', 'finished') DEFAULT 'scheduled',

    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE
);

-- =================================================================
-- 4. VINCULOS DE JOGO (Times, Escalacoes, Presenca)
-- FKs apontam para users(id) diretamente
-- =================================================================

CREATE TABLE IF NOT EXISTS game_day_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_id INT NOT NULL,
    player_id INT NOT NULL,
    team VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'present',
    is_substitute TINYINT(1) DEFAULT 0,
    replaced_player_id INT,

    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (replaced_player_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    player_id INT NOT NULL,
    team VARCHAR(10) NOT NULL,
    is_goalkeeper TINYINT(1) DEFAULT 0,

    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT,
    day_id INT,
    player_id INT,
    rule_id INT NOT NULL,
    quantity INT DEFAULT 1,
    timestamp DATETIME NOT NULL,
    created_by INT NOT NULL,
    context JSON,

    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES scoring_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- =================================================================
-- 5. FINANCEIRO E INSCRICOES (Signups)
-- =================================================================

CREATE TABLE IF NOT EXISTS game_day_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_id INT NOT NULL,
    user_id INT NOT NULL,
    amount FLOAT DEFAULT 0.0,
    status ENUM('pending', 'paid') DEFAULT 'pending',
    payment_type ENUM('monthly', 'single') DEFAULT 'single',
    paid_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_day_signups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    slot_type ENUM('goalkeeper', 'player', 'reserve') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY game_day_signups_day_user_unique (day_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_signups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    slot_type ENUM('goalkeeper', 'player', 'reserve') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY match_signups_match_user_unique (match_id, user_id)
);

-- =================================================================
-- 6. DIVERSOS E ESTATISTICAS
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (day_id) REFERENCES game_days(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (removed_player_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_season_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    season_id INT NOT NULL,
    total_points INT DEFAULT 0,
    matches_played INT DEFAULT 0,
    last_updated DATETIME NOT NULL,

    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CHECK (total_points >= 0)
);

-- FIM DO TEMPLATE JOGADOR
