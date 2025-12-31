# Migrating from AI Swarm v1 to v2

This guide helps you migrate from the original AI Swarm (bash + Docker containers) to v2 (Temporal.io).

## Key Differences

| Aspect | v1 | v2 |
|--------|----|----|
| Orchestration | File-based inboxes | Temporal workflows |
| Language | Bash scripts | TypeScript |
| Container Model | 1 container per agent | Worker pool |
| State | Git-based | Temporal persistence |
| LLM Integration | Gemini CLI (shell) | Gemini CLI (TypeScript wrapper) |
| Dashboard | Express + vanilla JS | Next.js |

## Migration Steps

### Step 1: Preserve System Prompts

The v2 system prompts are embedded in `packages/shared/src/llm.ts`. If you've customized your v1 prompts, update the constants:

```typescript
const PLANNER_PROMPT = `Your custom prompt here...`;
const CODER_PROMPT = `Your custom prompt here...`;
// etc.
```

### Step 2: Migrate Pending Tasks

If you have tasks in `.agent/inbox/`:

1. For each task file, create a v2 workflow:
   ```bash
   pnpm cli submit -t "Task Title" -c "$(cat .agent/inbox/task.md)"
   ```

2. Or use the portal at http://localhost:3000/submit

### Step 3: Stop v1 Containers

```bash
cd /path/to/ai-swarm-v1/docker
docker compose down
```

### Step 4: Transfer Gemini Authentication

If running workers on new machines, authenticate Gemini CLI:
```bash
gemini
# Follow OAuth flow
```

### Step 5: Update GitHub Webhooks

If you had webhooks pointing to v1 endpoints, update them to v2 API routes or remove them (v2 doesn't require webhooks).

## Coexistence

You can run v1 and v2 side-by-side during migration:
1. Keep v1 for existing work
2. Use v2 for new tasks
3. Gradually migrate

## Rollback

If you need to rollback:
1. Stop v2 worker and portal
2. Start v1 containers
3. Resume inbox-based workflow

## Feature Parity Checklist

- [x] Planner creates implementation plans
- [x] Coder implements and creates PRs
- [x] Deployer verifies builds
- [x] Supervisor monitors health
- [x] Email notifications
- [x] Model cascade on quota
- [x] Human approval workflow
- [x] Web dashboard
- [x] CLI tool

## New in v2

Features not in v1:
- **Durable execution**: Workflows survive worker crashes
- **Signals**: Approve/reject workflows programmatically
- **Temporal UI**: Built-in workflow debugging at http://localhost:8233
- **Observability**: OpenTelemetry tracing and metrics
- **Scalable workers**: Run multiple workers for parallelism
