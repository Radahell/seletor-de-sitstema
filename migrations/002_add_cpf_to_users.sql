-- ==========================================
-- MIGRACAO: Adicionar CPF na tabela users (Hub)
-- Data: 2026-02-10
-- Descricao: CPF como identificador padrao do
--            cliente para integracao entre sistemas
-- ==========================================

ALTER TABLE users
    ADD COLUMN cpf VARCHAR(14) NULL AFTER phone,
    ADD INDEX idx_users_cpf (cpf);
