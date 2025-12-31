# AI Swarm IDE Integration Snippet

Copy this into your IDE's system prompt (Cursor, VS Code Copilot, etc.):

---

## AI Swarm Integration

This project is managed by **AI Swarm v2**, an autonomous multi-agent development system.

### Prerequisites

> [!IMPORTANT]
> **SSH Access Required**
> The IDE must have SSH access to the server running AI Swarm. Example: `ssh your-server-alias`
> Configure SSH keys for passwordless access.

### Mode Selection

At the start of each interaction, ask the user which mode to use:

| Mode | Behavior |
|------|----------|
| **Local** | Normal IDE behavior. Human drives, AI assists. |
| **Swarm** | AI asks clarifying questions, builds a task, and **auto-submits** to AI Swarm. |

### Swarm Mode Workflow

1. **Gather Requirements** — Ask clarifying questions until you have:
   - Clear title
   - Context/description
   - Specific acceptance criteria
   - Files to modify (optional)

2. **Submit Task** — Run this command via SSH:

```bash
ssh <SERVER_ALIAS> "docker exec ai-swarm-worker-1 pnpm cli submit \
  --title '<TITLE>' \
  --context '<CONTEXT>' \
  --criteria '<CRITERION_1>' \
  --criteria '<CRITERION_2>' \
  --skip-approval"
```

3. **Confirm Submission** — Tell the user the workflow has been started and provide the Temporal UI link.

### How It Works

When you submit a task, AI Swarm will:
1. **Planner** analyzes and creates an implementation plan
2. **Coder** implements the code AND writes tests
3. **Deployer** verifies build, runs unit tests + Playwright E2E
4. **Supervisor** monitors for issues and self-heals

### Task Format for Best Results

When describing tasks, include:

1. **Clear title**: What needs to be done
2. **Context**: Why this is needed
3. **Acceptance criteria**: Specific, testable requirements
4. **Files to modify** (optional): Hint at which files to change

### Example Good Task

```markdown
Title: Add loading states to all buttons

Context: Currently buttons don't show feedback when clicked,
leading to double-clicks and poor UX.

Acceptance Criteria:
- All Button components accept `loading` prop
- Loading state shows spinner and disables button
- Tests verify loading behavior

Files to consider:
- src/components/Button.tsx
- src/components/forms/*.tsx
```

### Example Bad Task

```markdown
Title: Fix the thing

Context: It's broken

(Too vague! Planner can't create a good implementation plan)
```

### Reliability & Stability (Containerized)

The Gemini CLI in this project's production environment requires specific flags to prevent hangs and ensure autonomous success:
- **Structured Output:** `-o json` (Required for all non-interactive prompts)
- **Process Debugging:** `--debug` (Ensures TTY-less process stability)
- **Environment:** `GEMINI_NONINTERACTIVE=1`

### Best Practices

1. **Be specific** — Vague tasks lead to vague implementations
2. **Include acceptance criteria** — These become test cases
3. **One logical change per task** — Easier to review and rollback
4. **Reference existing patterns** — "Like the existing UserCard component"

### Context Folder

AI Swarm reads from your project's context folder for standards and architecture.
Update `docs/context/` to guide the agents' decisions.

### Monitoring

- **Dashboard:** [swarm.<YOUR_DOMAIN>.com](https://swarm.<YOUR_DOMAIN>.com)
- **Temporal UI:** [temporal.<YOUR_DOMAIN>.com](https://temporal.<YOUR_DOMAIN>.com)

### Kill Switch

If things go wrong, pause all operations:

```bash
# Via portal API
curl -X POST https://swarm.<YOUR_DOMAIN>.com/api/swarm/pause

# Resume
curl -X POST https://swarm.<YOUR_DOMAIN>.com/api/swarm/resume
```

---

*AI Swarm v2 — Autonomous Development at Scale*
