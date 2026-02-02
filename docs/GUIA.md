# SUPER MULTI-TENANT

Este projeto é um starter multi-sistema + multi-tenant.

## Estrutura
- **Sistemas**: Jogador, Quadra, Árbitro
- **Tenants**: Copa Brahma, Copa AposentadoS, Arena Sport...

## Setup rápido
1) `cp .env.example .env`
2) `docker compose up -d --build`

Se quiser o frontend em modo dev:

```bash
docker compose --profile dev up -d --build
```

## Rotas
- `GET /api/systems`
- `GET /api/systems/<slug>/tenants`
- `POST /api/tenants/select`

Mais detalhes: veja o `README.md`.
