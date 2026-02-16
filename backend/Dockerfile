FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependências
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Código (em runtime é sobreposto pelo volume do docker-compose)
COPY backend /app

ARG API_PORT=22012
ENV API_PORT=${API_PORT}
EXPOSE ${API_PORT}

CMD gunicorn -b 0.0.0.0:${API_PORT} -w 2 --threads 4 "app.main:app"
