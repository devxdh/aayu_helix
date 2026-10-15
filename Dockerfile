# -----------------------------------------------------------------------------
# Multi-stage production Dockerfile for Triage (SQLite Native Engine)
# -----------------------------------------------------------------------------

FROM node:20-alpine AS base
WORKDIR /app

# 1. Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# 2. Rebuild the source code only when needed
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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create persistent data directory for SQLite & WAL
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data && chmod -R 777 /app/data

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy compiled better-sqlite3 native addon to ensure resolution in standalone runner
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

USER nextjs

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server.js"]
