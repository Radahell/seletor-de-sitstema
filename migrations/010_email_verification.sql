-- Migration 010: Add email verification token columns
-- The email_verified_at column already exists in schema

ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(64) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN email_verification_sent_at TIMESTAMP NULL DEFAULT NULL;

CREATE INDEX idx_users_verification_token ON users(email_verification_token);
