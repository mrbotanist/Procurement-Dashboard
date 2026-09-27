# Production image for FPV Procurement Hub.
# Build:  docker compose -f docker-compose.prod.yml build
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies (postinstall runs prisma generate, so the schema comes first).
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build && rm -rf .next/cache

# Runtime keeps node_modules so migrations and the admin/import scripts work inside the container.
FROM base AS runner
ENV NODE_ENV=production PORT=3000 STORAGE_DIR=/app/storage
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/storage /app/logs && chown node:node /app/storage /app/logs
USER node
EXPOSE 3000
CMD ["sh", "deploy/docker-entrypoint.sh"]
