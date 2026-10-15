# -----------------------------------------------------------------------------
# Lightweight production Dockerfile for Triage (Node 22 glibc)
# -----------------------------------------------------------------------------

FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# 1. Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# 2. Copy source code and build standalone Next.js
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_CPU_COUNT=1
ENV NODE_OPTIONS="--max-old-space-size=768"

RUN npm run build && rm -rf .next/cache /root/.npm && find node_modules/better-sqlite3/prebuilds/ -mindepth 1 -maxdepth 1 ! -name '*linux-x64*' -exec rm -rf {} + 2>/dev/null || true

# 3. Production runner (minimal standalone bundle)
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN mkdir -p /app/data && chmod -R 777 /app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server.js"]
