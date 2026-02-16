-- ==========================================
-- MIGRACAO: Adicionar endereço e timezone nos users (Hub)
-- Data: 2026-02-10
-- Descricao: Campos de endereço para o usuário central.
--            Timezone derivado da cidade selecionada.
-- ==========================================

ALTER TABLE users
    ADD COLUMN address TEXT NULL AFTER cpf,
    ADD COLUMN city VARCHAR(100) NULL AFTER address,
    ADD COLUMN state VARCHAR(2) NULL AFTER city,
    ADD COLUMN timezone VARCHAR(50) NULL DEFAULT 'America/Sao_Paulo' AFTER state,
    ADD INDEX idx_users_city (city),
    ADD INDEX idx_users_state (state);
