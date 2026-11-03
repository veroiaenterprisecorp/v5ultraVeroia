# ============================================================================
# VEROIA v5-Ultra — Production Cloud Container
# Multi-stage build for High-Performance Forensic Image Analysis Backend
# ============================================================================

# --- Stage 1: Build Frontend Assets ---
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build Vite SPA
COPY . .
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV MAX_FILE_SIZE_MB=50

# Security: run as non-root node user
USER node

# Copy dependencies and built assets
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/server.ts ./
COPY --chown=node:node --from=builder /app/tsconfig.json ./

EXPOSE 3000

# Health check against /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
