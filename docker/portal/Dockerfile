# AI Swarm v2 - Portal Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/portal/package.json ./apps/portal/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY tsconfig.base.json ./
COPY apps/portal/ ./apps/portal/
COPY packages/shared/ ./packages/shared/

# Build
WORKDIR /app
RUN pnpm --filter @ai-swarm/shared build
WORKDIR /app/apps/portal
RUN pnpm build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install system dependencies for Gemini CLI
RUN apk add --no-cache curl bash git

# Install build dependencies for native Node modules
RUN apk add --no-cache --virtual .build-deps python3 make g++

# Install Gemini CLI globally
RUN npm install -g @google/gemini-cli

# Clean up build dependencies
RUN apk del .build-deps

ENV NODE_ENV=production

# Copy standalone build
COPY --from=builder /app/apps/portal/.next/standalone ./
COPY --from=builder /app/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=builder /app/apps/portal/public ./apps/portal/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/portal/server.js"]
