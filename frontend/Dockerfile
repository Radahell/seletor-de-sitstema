# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN chmod +x node_modules/.bin/* && npm run build

# ---- Production stage ----
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# SPA nginx config: serve static + fallback to index.html
RUN cat > /etc/nginx/conf.d/spa.conf <<'NGINX'
server {
    listen 22011;
    root /usr/share/nginx/html;
    index index.html;

    # gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 256;

    # cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 22011

CMD ["nginx", "-g", "daemon off;"]
