# SUPER MULTI-TENANT (Várzea Prime)

Este repositório é um **starter** multi-sistema + multi-tenant com:

- **MySQL** (banco master `varzeaprime_config` + bancos de tenants)
- **API Flask** (lista sistemas/tenants e faz seleção de tenant)
- **Frontend React (Vite + Tailwind)** com 2 telas:
  - Selecionar **Sistema**
  - Selecionar **Tenant** do sistema
- **Nginx** (proxy para `/api` + uploads; em DEV pode proxyar para o Vite; em PROD serve `frontend/dist`)

---

## Estrutura

```
.
├─ docker-compose.yml
├─ .env.example
├─ init-databases.sh
├─ schema-super-multitenant.sql
├─ backend/
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ app/
│  │  ├─ main.py
│  │  └─ db.py
│  └─ uploads/
├─ frontend/
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ .env.example
│  ├─ vite.config.ts
│  └─ src/
│     ├─ App.tsx
│     └─ pages/
│        ├─ SystemSelectPage.tsx
│        └─ TenantSelectBySystemPage.tsx
└─ nginx/
   ├─ nginx.conf
   └─ conf.d/cors.conf
```

---

## Setup (prod / básico)

1) Crie o `.env` a partir do exemplo:

```bash
cp .env.example .env
```

2) Suba os serviços (MySQL + API + Nginx):

```bash
docker compose up -d --build
```

> **Obs.:** Sem o profile `dev`, o serviço `web` (Vite) não sobe.

3) Se você quiser servir o frontend estático (HTTPS/PROD), gere o `dist`:

```bash
cd frontend
cp .env.example .env
npm install
npm run build
cd ..
```

O Nginx já monta `./frontend/dist` em `/var/www/html`.

---

## Setup (dev)

Para rodar o frontend em modo dev dentro do Docker:

```bash
docker compose --profile dev up -d --build
```

- Vite: interno na rede do compose em `web:22001`
- Nginx (porta 80) proxya `/` para `web:22001`

---

## Rotas da API

- `GET /api/systems`
  - Lista sistemas (Jogador, Quadra, Árbitro...)

- `GET /api/systems/<system_slug>/tenants`
  - Lista tenants daquele sistema

- `POST /api/tenants/select`
  - Body: `{ "slug": "copa-aposentados" }`
  - Header opcional: `X-System-Slug: jogador`
  - Retorna o `tenant.branding` que o frontend salva no `localStorage`.

---

## Notas

- Os dados iniciais são criados pelo `schema-super-multitenant.sql`.
- Os bancos dos tenants são criados por `init-databases.sh`.
- Para multi-tenant real, o próximo passo é fazer a API resolver o tenant por:
  - subdomínio (`copa-aposentados.seudominio.com`) **ou**
  - header `X-Tenant-Slug`
  e então abrir engine/Session do DB correto.
