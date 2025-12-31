# AI Swarm v2 - Worker Dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    openssh-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Gemini CLI globally
# The Gemini CLI is installed via: npm install -g @google/gemini-cli
RUN npm install -g @google/gemini-cli

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/workflows/package.json ./packages/workflows/
COPY packages/worker/package.json ./packages/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/workflows/ ./packages/workflows/
COPY packages/worker/ ./packages/worker/

# Build all packages
RUN pnpm --filter @ai-swarm/shared build
RUN pnpm --filter @ai-swarm/workflows build
RUN pnpm --filter @ai-swarm/worker build

# Create non-root user
RUN useradd -m -s /bin/bash worker
USER worker

# Set environment variables
ENV NODE_ENV=production
ENV TEMPORAL_ADDRESS=temporal:7233
ENV TEMPORAL_NAMESPACE=ai-swarm

# Start the worker
CMD ["node", "packages/worker/dist/index.js"]

