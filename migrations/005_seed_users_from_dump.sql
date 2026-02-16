-- ==========================================
-- MIGRAÇÃO 005: Seed de Usuários do Dump copa_aposentados
-- Data: 2026-02-15
-- Descrição: Importa usuários do dump antigo para o hub centralizado
--            e cria o super admin (Radael Ivan)
-- ==========================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==========================================
-- 1. SUPER ADMIN: Radael Ivan
-- Senha: MA13036619.1802
-- Hash werkzeug (scrypt)
-- ==========================================
INSERT INTO super_admins (name, email, password_hash, is_active)
VALUES (
    'Radael Ivan da Silva Insfran',
    'radaelivan@gmail.com',
    'scrypt:32768:8:1$vNjkThXMZOPYJNro$78f0be83d0b0a66ed49fb7cc9d6fcc4e68f7002266f98a354de3ef48b4a7288b99e66217a9c4512e8f3d8320c268f4c217264888fa4b5da10647e45677491930',
    TRUE
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    password_hash = VALUES(password_hash),
    is_active = VALUES(is_active);

-- ==========================================
-- 2. USUÁRIOS NO HUB (tabela users)
-- Radael: senha real MA13036619.1802
-- Demais: senha temporária "mudar123"
-- ==========================================

-- Radael Ivan (super admin + admin do tenant)
INSERT INTO users (name, nickname, email, phone, password_hash, is_active, email_verified_at)
VALUES (
    'Radael Ivan da Silva Insfran', 'RadaHell', 'radaelivan@gmail.com', NULL,
    'scrypt:32768:8:1$vNjkThXMZOPYJNro$78f0be83d0b0a66ed49fb7cc9d6fcc4e68f7002266f98a354de3ef48b4a7288b99e66217a9c4512e8f3d8320c268f4c217264888fa4b5da10647e45677491930',
    TRUE, NOW()
)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Matheus Figueiredo
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Matheus Figueiredo', 'Leo Figueira', 'figueiredomatheus397@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Matheus Cunha Flores Monteiro
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Matheus Cunha Flores Monteiro', 'El cucunha', 'mrmatheuscunha@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- EZEQUIAS DA SILVA CORREA FILHO (admin no tenant)
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('EZEQUIAS DA SILVA CORREA FILHO', 'Mesut Kilo', 'ezequiascorrea660@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Marcos Poquiviqui Santana
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Marcos Poquiviqui Santana', 'Poke', 'vikpoke666@gmail.com', '65996822631',
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Rodrigo Leon
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Rodrigo Leon', 'Rodrigol', 'goncalvesalencar@hotmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Felipe Eduardo da Silva Campos
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Felipe Eduardo da Silva Campos', 'Buzz', 'drackaru@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Guilherme Coelho Soares
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Guilherme Coelho Soares', 'Gui Negão', 'coelhovrf@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Luciano Lopes
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Luciano Lopes', 'Lulu Depay', 'lopez.luciano9522@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Michael Douglas
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Michael Douglas', 'D''Michael', 'mayconreua@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Gabriel Rossi Soares
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Gabriel Rossi Soares', 'Messi', 'gabisrossi2002@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Gabriel Almeida de Oliveira
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Gabriel Almeida de Oliveira', 'Paolo Almeidini', 'almeida270415@gmail.com', '67999575709',
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Lothar Mateus (admin no tenant)
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Lothar Mateus', 'Big', 'lothar.mateussc@hotmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Victor Moraes Miranda (admin no tenant)
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Victor Moraes Miranda', 'Vitão', 'mirandarotvic123@gmail.com', '67999399865',
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Gabriel Januario Garcia Martins
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Gabriel Januario Garcia Martins', 'Januba', 'paudaplaca7@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- BRUNO ARIEL DINIZ DA SILVA
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('BRUNO ARIEL DINIZ DA SILVA', 'BRUNERA', 'bdiniiz22@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Joaquim Clink Ribeiro
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Joaquim Clink Ribeiro', 'Estevão', 'joaquimclinkribeiro@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Matheus Guilherme Durães Fernandes
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Matheus Guilherme Durães Fernandes', 'Gui neguinho', 'fernandesfernandes@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Luan Cassaro
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Luan Cassaro', 'Sanfoneiro', 'lcassaro2015@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Matheus Guilherme Durães Fernandes (conta 2)
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Matheus Guilherme Durães Fernandes', 'Guizinho negãozinho', 'fernandesfernandes1377@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Bruno Marinho Maciel
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Bruno Marinho Maciel', 'Brunou14', 'brunomarinhomaciel17@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Caio Cezar Braga Bressan
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Caio Cezar Braga Bressan', 'Caio', 'redentorms@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Nathan Vinícius Ferreira Diniz
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Nathan Vinícius Ferreira Diniz', 'Tanan', 'dzferreira20@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Renato Gonçalves Martins
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Renato Gonçalves Martins', 'Comi o de cima 🤣', 'gauduny@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- elinson
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('elinson', 'Elinson', 'elinson@copa.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- teste
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('teste', 'teste', 'teste@copa.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Welyton Jhonny
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Welyton Jhonny', 'Muro', 'Welyton@copa.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- João Vitor Ferreira
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('João Vitor Ferreira', 'TotinRabando', 'joao261099vitor@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Lucas de Graauw Zimpel
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Lucas de Graauw Zimpel', 'Lucas', 'lucasgraauw14@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Marcos Vinicius
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Marcos Vinicius', 'McQueen', 'marcosalved@hotmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Mateus Augusto Colman Cheung
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Mateus Augusto Colman Cheung', 'Cheung', 'cheungmateus@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Lucas Abdiel Vargas Martines
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Lucas Abdiel Vargas Martines', 'Lucas m', 'abdiel.lucaseliane@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Diego Massanori
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Diego Massanori', 'Massanori', 'dmot0896@gmail.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Substituto 1
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Substituto 1', 'Substituto 1', 'substituto1@copaaposentado.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Substituto 2
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Substituto 2', 'Substituto 2', 'subistituto2@copaaposentados.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- Substituto 3
INSERT INTO users (name, nickname, email, phone, password_hash, is_active)
VALUES ('Substituto 3', 'Substituto 3', 'subistituto3@dopaaposentados.com', NULL,
    'scrypt:32768:8:1$0b9cJsYgNCsi6Qrb$e61db080e195a1cd92ad72f0d88a675d8bb0a9cee946dee91839e846dcf9c01789dec949d6bd4274e9178064b923e0ed7182f7786ac40978c8d9df1b89927429',
    TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), nickname = VALUES(nickname);

-- ==========================================
-- 3. MEMBERSHIPS (user_tenants)
-- Vincula todos os usuários ao tenant copa-aposentados (id=2)
-- Radael, Ezequias, Lothar, Victor = admin
-- Substitutos 1,2,3 = admin (eram admins no dump)
-- Demais = player
-- ==========================================

-- Radael Ivan → admin
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'admin', TRUE
FROM users u WHERE u.email = 'radaelivan@gmail.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;

-- Ezequias → admin
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'admin', TRUE
FROM users u WHERE u.email = 'ezequiascorrea660@gmail.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;

-- Lothar → admin
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'admin', TRUE
FROM users u WHERE u.email = 'lothar.mateussc@hotmail.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;

-- Victor → admin
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'admin', TRUE
FROM users u WHERE u.email = 'mirandarotvic123@gmail.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;

-- Substituto 1 → admin
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'admin', TRUE
FROM users u WHERE u.email = 'substituto1@copaaposentado.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;

-- Substituto 2 → admin
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'admin', TRUE
FROM users u WHERE u.email = 'subistituto2@copaaposentados.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;

-- Substituto 3 → admin
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'admin', TRUE
FROM users u WHERE u.email = 'subistituto3@dopaaposentados.com'
ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE;

-- Todos os demais jogadores → player
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT u.id, 2, 'player', TRUE
FROM users u
WHERE u.email NOT IN (
    'radaelivan@gmail.com',
    'ezequiascorrea660@gmail.com',
    'lothar.mateussc@hotmail.com',
    'mirandarotvic123@gmail.com',
    'substituto1@copaaposentado.com',
    'subistituto2@copaaposentados.com',
    'subistituto3@dopaaposentados.com'
)
ON DUPLICATE KEY UPDATE role = 'player', is_active = TRUE;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- RESUMO:
-- - 1 super_admin criado (Radael Ivan, senha: MA13036619.1802)
-- - 35 usuários inseridos no hub (users)
--   - Radael: senha real MA13036619.1802
--   - Demais: senha temporária "mudar123"
-- - 35 memberships criadas em user_tenants → copa-aposentados
--   - 7 admins (Radael, Ezequias, Lothar, Victor, Substituto 1/2/3)
--   - 28 players
-- ==========================================
