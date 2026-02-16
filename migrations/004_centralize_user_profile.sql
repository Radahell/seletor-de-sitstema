-- ==========================================
-- MIGRACAO: Centralizar perfil do usuário no hub
-- Data: 2026-02-10
-- Descricao:
--   1) CNPJ para users e tenants
--   2) Endereço normalizado (CEP, logradouro, numero, bairro, complemento)
--   3) Tabela user_interests (lead capture)
-- ==========================================

-- users: adicionar CNPJ e endereço normalizado
ALTER TABLE users
    ADD COLUMN cnpj VARCHAR(18) NULL AFTER cpf,
    ADD COLUMN cep VARCHAR(9) NULL AFTER address,
    ADD COLUMN logradouro VARCHAR(200) NULL AFTER cep,
    ADD COLUMN numero VARCHAR(20) NULL AFTER logradouro,
    ADD COLUMN bairro VARCHAR(100) NULL AFTER numero,
    ADD COLUMN complemento VARCHAR(100) NULL AFTER bairro,
    ADD INDEX idx_users_cnpj (cnpj),
    ADD INDEX idx_users_cep (cep);

-- tenants: adicionar CNPJ para estabelecimentos
ALTER TABLE tenants
    ADD COLUMN cnpj VARCHAR(18) NULL AFTER email;

-- user_interests: lead capture (quais serviços o usuário tem interesse)
CREATE TABLE IF NOT EXISTS user_interests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    system_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_interests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_interests_system FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_user_interest (user_id, system_id),
    INDEX idx_user_interests_system (system_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
