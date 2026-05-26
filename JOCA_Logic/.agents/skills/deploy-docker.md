---
name: deploy-docker
description: "Use when containerizing applications, writing Dockerfiles, docker-compose, or setting up container orchestration."
triggers: docker, Docker, container, docker compose, docker-compose, Dockerfile, VPS, vps deploy, containerizar, containerize, Traefik, Caddy, nginx docker, php-fpm docker, docker production, docker deploy, imagem docker, docker image, registry, docker hub
---
# Deploy — Docker on VPS

Deploy de Laravel em Docker numa VPS propria. Controlo total sobre o ambiente.

---

## Arquitectura standard

```
VPS
├── Traefik / Caddy        <- reverse proxy + SSL
├── app (PHP-FPM)          <- aplicacao
├── web (Nginx)            <- static files + FastCGI
├── db (MySQL/PostgreSQL)  <- database
├── redis                  <- cache / queue / sessions
├── queue (PHP-CLI)        <- queue worker
└── scheduler (PHP-CLI)    <- cron
```

---

## Multi-stage Dockerfile

```dockerfile
# Stage 1: Composer
FROM composer:2.7 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

# Stage 2: Assets
FROM node:20-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY resources/ resources/
COPY vite.config.js ./
RUN npm run build

# Stage 3: Production
FROM php:8.3-fpm-alpine AS production

RUN apk add --no-cache libpq-dev libzip-dev libicu-dev libpng-dev libjpeg-dev freetype-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install pdo pdo_mysql pdo_pgsql bcmath intl zip gd opcache pcntl \
 && pecl install redis && docker-php-ext-enable redis

RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php/opcache.ini $PHP_INI_DIR/conf.d/opcache.ini

WORKDIR /var/www
COPY --chown=www-data:www-data . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

RUN chmod -R 775 storage bootstrap/cache
USER www-data
EXPOSE 9000
CMD ["php-fpm"]
```

### opcache.ini (producao)
```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=20000
opcache.revalidate_freq=0
opcache.validate_timestamps=0
```

**Regras:**
- NUNCA copiar `.env` para dentro da imagem
- Multi-stage build para imagens pequenas (~100MB vs ~500MB)
- `--no-dev` no composer install
- `USER www-data` (nunca root)

---

## docker-compose.yml (producao)

```yaml
name: laravel-prod

services:
  web:
    image: nginx:alpine
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - laravel-storage:/var/www/storage:ro
    depends_on:
      php-fpm:
        condition: service_healthy
    restart: unless-stopped

  php-fpm:
    build: { context: ., target: production }
    volumes:
      - laravel-storage:/var/www/storage
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "php-fpm-healthcheck || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped

  queue:
    build: { context: ., target: production }
    volumes:
      - laravel-storage:/var/www/storage
    env_file: .env
    command: ["php", "artisan", "queue:work", "redis", "--tries=3", "--timeout=90", "--sleep=3"]
    stop_signal: SIGTERM
    stop_grace_period: 30s
    depends_on:
      php-fpm: { condition: service_healthy }
    restart: unless-stopped

  scheduler:
    build: { context: ., target: production }
    volumes:
      - laravel-storage:/var/www/storage
    env_file: .env
    command: ["sh", "-c", "while true; do php artisan schedule:run; sleep 60; done"]
    depends_on:
      php-fpm: { condition: service_healthy }
    restart: unless-stopped

  db:
    image: mysql:8.4
    volumes:
      - db-data:/var/lib/mysql
    environment:
      MYSQL_DATABASE: ${DB_DATABASE}
      MYSQL_USER: ${DB_USERNAME}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped

volumes:
  laravel-storage:
  db-data:
```

---

## SSL -- Traefik (recomendado)

Adicionar ao docker-compose.yml:

```yaml
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.email=admin@domain.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

# Adicionar labels ao servico web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`domain.com`)"
      - "traefik.http.routers.app.tls.certresolver=le"
      - "traefik.http.routers.app.entrypoints=websecure"
```

Alternativa simples: **Caddy** (HTTPS automatico, zero config):
```
# Caddyfile
domain.com {
    reverse_proxy web:80
}
```

---

## CI/CD -- GitHub Actions

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_HUB_USERNAME }}
          password: ${{ secrets.DOCKER_HUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ secrets.DOCKER_HUB_USERNAME }}/app:latest,${{ secrets.DOCKER_HUB_USERNAME }}/app:${{ github.sha }}

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/app
            docker compose pull
            docker compose up -d --remove-orphans
            docker compose exec -T php-fpm php artisan migrate --force
            docker compose exec -T php-fpm php artisan config:cache
            docker compose exec -T php-fpm php artisan route:cache
            docker image prune -f
```

---

## VPS setup

```bash
# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Deploy user
adduser deploy && usermod -aG docker deploy

# Firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# App directory
mkdir -p /opt/app && chown deploy:deploy /opt/app

# .env (nunca em git)
scp .env.production deploy@vps:/opt/app/.env
```

---

## Backups

### Database
```bash
docker compose exec db mysqldump -u root -p$MYSQL_ROOT_PASSWORD $DB_DATABASE | gzip > /backups/db-$(date +%Y%m%d).sql.gz
```

### Storage volumes
```bash
docker run --rm -v laravel-prod_laravel-storage:/data -v /backups:/backup alpine tar czf /backup/storage-$(date +%Y%m%d).tar.gz /data
```

Retencao: daily 7 dias, weekly 4 semanas.

---

## Common pitfalls

| Problema | Causa | Fix |
|----------|-------|-----|
| Container nao liga a DB no startup | Sem health check dependency | `condition: service_healthy` no `depends_on` |
| Codigo antigo apos deploy | OPcache cached | Reload php-fpm ou rebuild imagem |
| `.env` baked na imagem | `COPY .env` no Dockerfile | Nunca copiar -- montar ou `env_file` |
| Imagem grande (500MB+) | Dev deps incluidas | Multi-stage build + `--no-dev` |
| Queue worker perde jobs no deploy | Kill abrupto | `stop_signal: SIGTERM` + `stop_grace_period: 30s` |
| Let's Encrypt rate limits | Muitos pedidos | Usar staging ACME em testes |
| Storage perdido entre deploys | Sem named volume | Volume nomeado, nunca bind mount |
| DB/Redis expostos publicamente | Ports mapeados | Nao expor -- rede interna Docker |

---

## Security

- Containers como non-root (`USER www-data`)
- DB/Redis so na rede interna (sem port mapping publico)
- SSH key-only auth na VPS (desactivar password)
- `cap_drop: [ALL]` nos containers
- Actualizar base images regularmente
- Scan com `docker scout` ou `trivy`

---

## Checklist

- [ ] Dockerfile multi-stage (vendor + assets + production)
- [ ] `.env` NAO copiado para imagem
- [ ] Health checks em todos os servicos
- [ ] `depends_on` com `condition: service_healthy`
- [ ] Queue worker com `stop_grace_period: 30s`
- [ ] Named volumes para storage e DB data
- [ ] SSL via Traefik ou Caddy
- [ ] Firewall: so 22, 80, 443
- [ ] DB/Redis sem ports expostos
- [ ] Backup automatizado (DB + storage)
- [ ] CI/CD pipeline funcional
- [ ] `APP_ENV=production`, `APP_DEBUG=false`
