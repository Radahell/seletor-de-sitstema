-- Migration 009: Adicionar campo de onboarding concluído
-- Permite rastrear se o usuário já completou o wizard de boas-vindas

ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMP NULL DEFAULT NULL AFTER last_login_at;

-- Marcar usuários existentes como onboarding completo (já conhecem o sistema)
UPDATE users SET onboarding_completed_at = created_at WHERE onboarding_completed_at IS NULL;
