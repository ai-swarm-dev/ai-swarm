# AI Swarm v2## Production Deployment (Traefik)

This project requires a Traefik reverse proxy for production-grade security and SSL.

### 1. Pre-requisites
Ensure you have a Traefik instance running and connected to a public Docker network (default: `traefik-public`).

If you don't have Traefik, run this minimal setup:

```bash
docker network create traefik-public

docker run -d \
  -p 80:80 \
  -p 443:443 \
  --network traefik-public \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ./letsencrypt:/letsencrypt \
  traefik:v2.10 \
  --providers.docker=true \
  --providers.docker.exposedbydefault=false \
  --entrypoints.web.address=:80 \
  --entrypoints.websecure.address=:443 \
  --certificatesresolvers.letsencrypt.acme.email=your-email@example.com \
  --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json \
  --certificatesresolvers.letsencrypt.acme.httpchallenge=true \
  --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
```

### 2. DNS Configuration
Set up A records for your domain to point to this server:
- `example.com` (Portal)
- `temporal.example.com` (Temporal UI)
- `grafana.example.com` (Grafana)

### 3. Deploy
Run `./deploy.sh` and follow the prompts. You will be asked for:
- Base Domain
- Traefik Network Name
- Subdomain customization preference

---

## Local Development (Legacy)

This guide walks you through setting up AI Swarm v2 from scratch.

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Docker | 20+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | 2.0+ | Included with Docker Desktop |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 8+ | `npm install -g pnpm` |
| Git | Any | [git-scm.com](https://git-scm.com/) |
| GitHub CLI | Any | [cli.github.com](https://cli.github.com/) (optional) |

### Required Accounts

1. **GitHub Account** with a [Personal Access Token](https://github.com/settings/tokens)
   - Scopes needed: `repo`, `workflow`

2. **Google Cloud Account** with OAuth credentials
   - See [Google OAuth Setup](#google-oauth-setup) below

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth Client ID**
5. Choose **Web application**
6. Add authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Copy your **Client ID** and **Client Secret**

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ai-swarm-v2.git
cd ai-swarm-v2
```

### 2. Run the Deployment Script

```bash
./deploy.sh
```

The script will:
- Check all prerequisites
- Detect port conflicts
- Prompt for configuration:
  - GitHub token and repo
  - Project directory to work on
  - Google OAuth credentials
  - Allowed email addresses
  - Email notifications (optional)
- Generate `.env` file
- Build and start all containers

### 3. Authenticate Gemini CLI

```bash
./auth-gemini.sh
```

This opens an interactive session for each of the 4 workers.
Follow the prompts to authenticate with Google.

### 4. Access the Portal

Open [http://localhost:3000](http://localhost:3000)

Sign in with your allowed Google account.

---

## Worker Access

Workers are Docker containers. To access them:

```bash
# List workers
docker ps --filter "name=ai-swarm-worker"

# Access a worker shell
docker exec -it ai-swarm-worker-1 /bin/bash

# Run Gemini CLI manually
docker exec -it ai-swarm-worker-1 gemini

# View worker logs
docker logs -f ai-swarm-worker-1
```

---

## Troubleshooting

### Authentication Errors

**"Access Denied" on sign-in:**
- Check your email is in `ALLOWED_EMAILS` in `.env`
- Verify OAuth redirect URI matches exactly

**"Invalid Client" error:**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check OAuth consent screen is configured

### Gemini CLI Issues

**Workers not responding:**
```bash
# Re-authenticate a specific worker
docker exec -it ai-swarm-worker-1 gemini
```

**Rate limiting:**
- The model cascade will automatically try fallback models
- Check Gemini CLI quota in Google Cloud Console

### Port Conflicts

If default ports are in use, `deploy.sh` will offer alternatives.
Or manually edit `.env`:

```bash
PORTAL_PORT=3000
TEMPORAL_UI_PORT=8233
GRAFANA_PORT=3001
```

---

## Tear Down

To completely remove AI Swarm:

```bash
./teardown.sh
```

This removes:
- All containers
- All volumes (data will be lost!)
- Generated `.env` file
- Docker network

---

## Next Steps

1. Read the [IDE Integration Guide](prompts/IDE_SNIPPET.md)
2. Set up your project's context folder
3. Submit your first task through the portal
4. Monitor progress in Temporal UI
