# -----------------------------------------------------------------------------
# Multi-stage production Dockerfile for Triage (Debian Slim - Rock-Solid glibc)
# -----------------------------------------------------------------------------

FROM node:20-slim AS base
WORKDIR /app

# 1. Install dependencies (better-sqlite3 uses official prebuilt glibc binaries)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2. Rebuild the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_CPU_COUNT=1
ENV NODE_OPTIONS="--max-old-space-size=768"

RUN npm run build

# 3. Production runner image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Create persistent data directory for SQLite & WAL
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data && chmod -R 777 /app/data

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure better-sqlite3 native addon is available in standalone
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

USER nextjs

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server.js"]
