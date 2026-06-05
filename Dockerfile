# node:22-slim uses Debian (glibc), so node-gyp downloads headers from official
# nodejs.org instead of the unreliable unofficial-builds.nodejs.org (musl/alpine).

# ── Stage 1: install deps + compile native modules ────────────────────────────
FROM node:22-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl unzip && \
    rm -rf /var/lib/apt/lists/*

# Install bun to speed up dependency resolution
RUN npm install -g bun

WORKDIR /app
COPY package.json ./
RUN bun install

# ── Stage 2: build Next.js ────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN node_modules/.bin/next build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy installed node_modules from the dependency stage.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/templates ./src/templates

# SQLite data directory (mounted as a named volume)
RUN mkdir -p /data

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
