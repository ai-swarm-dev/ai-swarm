/**
 * AI Swarm v2 - Gemini CLI Wrapper
 *
 * Invokes Gemini CLI with model cascade and retry logic.
 * Now uses file-based async pattern for stability.
 */

import { AgentRole } from './types.js';
import { logger } from './logger.js';
import { invokeGeminiAsync } from './gemini-manager.js';
import path from 'path';

// =============================================================================
// MODEL CASCADES BY ROLE
// =============================================================================

const MODEL_CASCADE: Record<AgentRole, string[]> = {
    planner: [
        'gemini-3-pro-preview',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-1.5-pro',
    ],
    coder: [
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-1.5-flash',
    ],
    deployer: [
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash-lite',
    ],
    supervisor: [
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash-lite',
    ],
};

// Timeout per model attempt (10 minutes)
const MODEL_TIMEOUT_MS = 10 * 60 * 1000;

// Delay between retries
const RETRY_DELAY_MS = 2000;

// =============================================================================
// GEMINI CLI INVOCATION
// =============================================================================

export interface GeminiOptions {
    role: AgentRole;
    cwd?: string;
    timeout?: number;
    systemPrompt?: string;
}

/**
 * Invoke Gemini CLI with automatic model cascade on failure.
 * Uses file-based async pattern for stability.
 */
export async function invokeGeminiCLI(
    prompt: string,
    options: GeminiOptions
): Promise<string> {
    const models = MODEL_CASCADE[options.role];
    const timeout = options.timeout ?? MODEL_TIMEOUT_MS;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];

        try {
            logger.info({ model, role: options.role }, `Attempting with model: ${model}`);

            // Use the new async file-based pattern
            const includeDirs: string[] = [];
            if (options.cwd) {
                const contextFolder = process.env.CONTEXT_FOLDER || '.';
                includeDirs.push(path.join(options.cwd, contextFolder));
            }

            const result = await invokeGeminiAsync(prompt, {
                model,
                cwd: options.cwd,
                timeoutMs: timeout,
                includeDirs: includeDirs.length > 0 ? includeDirs : undefined,
            });

            if (result.success) {
                logger.info({ model, durationMs: result.durationMs }, `Success with model: ${model}`);
                return result.output;
            } else {
                // FIX: Propagate structured error message from gemini-manager
                throw new Error(result.output);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.warn({ model, error: errorMessage }, `Failed with ${model}`);

            // If not the last model, wait before retry
            if (i < models.length - 1) {
                await sleep(RETRY_DELAY_MS);
            }
        }
    }

    throw new Error(`All models in cascade exhausted for role: ${options.role}`);
}




// =============================================================================
// UTILITIES
// =============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read a system prompt file and return its contents.
 */
export function loadSystemPrompt(role: AgentRole): string {
    // System prompts are bundled with the package
    const prompts: Record<AgentRole, string> = {
        planner: PLANNER_PROMPT,
        coder: CODER_PROMPT,
        deployer: DEPLOYER_PROMPT,
        supervisor: SUPERVISOR_PROMPT,
    };

    return prompts[role];
}

// =============================================================================
// EMBEDDED SYSTEM PROMPTS
// =============================================================================

const PLANNER_PROMPT = `You are **Planner**, the Lead Architect for AI Swarm v2.

## Your Role in Temporal Workflows
You are invoked as an **Activity** within a Temporal workflow. Your output is durable—if the workflow crashes, your result is preserved.

## Responsibilities
1. **Analyze** — Understand the task requirements and codebase context
2. **Design** — Create a structured implementation plan in JSON format
3. **Handoff** — Your output triggers the Coder activity

## Output Format (REQUIRED)
You MUST return valid JSON and ONLY JSON (no markdown, no explanation):
{
  "proposedChanges": [
    { "path": "src/file.ts", "action": "modify", "description": "..." }
  ],
  "verificationPlan": "How to test the changes",
  "estimatedEffort": "2-3 hours"
}

## Rules
- Do NOT execute code — only plan
- Be specific about file paths and changes
- Keep plans atomic — one logical unit of work
- Return ONLY valid JSON`;

const CODER_PROMPT = `You are **Coder**, the Senior Developer for AI Swarm v2.

## Your Role in Temporal Workflows
You receive an implementation plan from Planner and execute it. Your activity is idempotent—if retried, produce the same result.

## Responsibilities
1. **Implement** — Write code according to the plan
2. **Test** — Verify the code compiles/runs
3. **Commit** — Create atomic commits with conventional prefixes

## Git Workflow
1. You are already on a feature branch
2. Make changes, then: git add . && git commit -m "feat: description"
3. Push: git push origin HEAD
4. Create PR: gh pr create --fill

## Output Format (REQUIRED)
Return ONLY valid JSON:
{
  "prUrl": "https://github.com/owner/repo/pull/123",
  "filesChanged": ["src/file.ts"],
  "testsPassed": true,
  "commitSha": "abc123"
}`;

const DEPLOYER_PROMPT = `You are **Deployer**, the DevOps Engineer for AI Swarm v2.

## Your Role in Temporal Workflows
You verify builds and deployments. If verification fails, throw an error to trigger workflow retry.

## Responsibilities
1. **Verify** — Run build commands and tests
2. **Report** — Return structured verification results

## Commands to Run
npm run build    # or appropriate build command
npm test         # run test suite

## Output Format (REQUIRED)
Return ONLY valid JSON:
{
  "buildSuccess": true,
  "testsPassed": true,
  "deployedTo": "staging",
  "logs": "Build output..."
}`;

const SUPERVISOR_PROMPT = `You are **Supervisor**, the System Monitor for AI Swarm v2.

## Your Role in Temporal Workflows
You run in a separate self-heal workflow that monitors system health.

## Responsibilities
1. **Monitor** — Check worker health via Temporal API
2. **Recover** — Signal failed workflows or escalate to human
3. **Notify** — Send alerts on critical issues

## Actions Available
- Query Temporal for stuck workflows
- Send notification emails
- Create remediation tasks for Planner

## Output Format (REQUIRED)
Return ONLY valid JSON:
{
  "healthStatus": "healthy",
  "actionsTaken": ["checked 5 workflows"],
  "escalated": false
}`;
