#!/bin/bash
set -e

echo "🚀 Inicializando bancos de dados..."

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<-SQL
    -- Jogador
    CREATE DATABASE IF NOT EXISTS copa_brahma_db;
    CREATE DATABASE IF NOT EXISTS copa_aposentados;
    CREATE DATABASE IF NOT EXISTS liga_ouro_db;
    
    -- Quadra
    CREATE DATABASE IF NOT EXISTS arena_sport_db;
    CREATE DATABASE IF NOT EXISTS society_club_db;
SQL

echo "✅ Bancos criados!"
