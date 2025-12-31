/**
 * AI Swarm v2 - Coder Activity
 *
 * Executes implementation plans and creates PRs using Gemini CLI.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
    ImplementationPlan,
    CoderOutput,
    invokeGeminiCLI,
    loadSystemPrompt,
    logger,
    logActivityStart,
    logActivityComplete,
} from '@ai-swarm/shared';

const execAsync = promisify(exec);

/**
 * Execute an implementation plan and create a PR.
 */
export async function executeCode(plan: ImplementationPlan): Promise<CoderOutput> {
    const startTime = Date.now();
    logActivityStart('coder', 'executeCode', { taskId: plan.taskId });

    const projectDir = process.env.PROJECT_DIR || process.cwd();
    const branchName = `feature/task-${plan.taskId}`;

    try {
        // =======================================================================
        // STEP 0: Authentication Setup
        // =======================================================================
        const token = process.env.GITHUB_TOKEN;
        if (token) {
            try {
                logger.info('Checking GitHub CLI status');
                await execAsync('gh auth status', { cwd: projectDir });
            } catch {
                logger.info('Authenticating GitHub CLI with token');
                await execAsync(`echo ${token} | gh auth login --with-token`, { cwd: projectDir });
            }

            try {
                // Use token for HTTPS authentication
                await execAsync(`git config --global url."https://${token}@github.com/".insteadOf "https://github.com/"`, { cwd: projectDir });
            } catch (err) {
                logger.warn({ err }, 'Failed to set git insteadOf config');
            }
        }

        // Set identity if not set
        await execAsync('git config --global user.email "swarm-bot@<YOUR_DOMAIN>.com"', { cwd: projectDir });
        await execAsync('git config --global user.name "AI Swarm Bot"', { cwd: projectDir });

        logger.info({ branchName }, 'Creating feature branch');

        await execAsync('git fetch origin main', { cwd: projectDir });
        await execAsync('git checkout main', { cwd: projectDir });
        await execAsync('git pull origin main', { cwd: projectDir });

        // Check if branch exists and delete it
        try {
            await execAsync(`git branch -D ${branchName}`, { cwd: projectDir });
        } catch {
            // Branch doesn't exist, that's fine
        }

        await execAsync(`git checkout -b ${branchName}`, { cwd: projectDir });

        // =======================================================================
        // STEP 2: Invoke Gemini CLI to implement changes
        // =======================================================================
        const systemPrompt = loadSystemPrompt('coder');

        const prompt = `${systemPrompt}

## Implementation Plan

**Task ID:** ${plan.taskId}

**Changes to Implement:**
${plan.proposedChanges.map((c) => `- ${c.action.toUpperCase()} ${c.path}: ${c.description}`).join('\n')}

**Verification Plan:**
${plan.verificationPlan}

---

Implement ALL the changes described above. After making changes:
1. Run: git add .
2. Run: git commit -m "feat(${plan.taskId}): implement changes"
3. Run: git push origin ${branchName}
4. Run: gh pr create --fill --base main

Return ONLY valid JSON with the result.`;

        const response = await invokeGeminiCLI(prompt, {
            role: 'coder',
            cwd: projectDir,
        });

        // Parse JSON from response
        const coderOutput = parseJsonFromResponse<Partial<CoderOutput>>(response);

        // =======================================================================
        // STEP 3: Verify and extract results
        // =======================================================================

        // Get commit SHA
        let commitSha = coderOutput.commitSha || '';
        if (!commitSha) {
            try {
                const { stdout } = await execAsync('git rev-parse HEAD', { cwd: projectDir });
                commitSha = stdout.trim();
            } catch {
                commitSha = 'unknown';
            }
        }

        // Get changed files
        let filesChanged = coderOutput.filesChanged || [];
        if (filesChanged.length === 0) {
            try {
                const { stdout } = await execAsync('git diff --name-only HEAD~1', { cwd: projectDir });
                filesChanged = stdout.trim().split('\n').filter(Boolean);
            } catch {
                filesChanged = [];
            }
        }

        // Get or create PR URL
        let prUrl = coderOutput.prUrl || '';
        if (!prUrl) {
            try {
                const { stdout } = await execAsync('gh pr view --json url -q .url', { cwd: projectDir });
                prUrl = stdout.trim();
            } catch {
                // PR might not exist yet, try to create it
                try {
                    const { stdout } = await execAsync(
                        `gh pr create --fill --base main --head ${branchName}`,
                        { cwd: projectDir }
                    );
                    prUrl = stdout.trim();
                } catch (prError) {
                    logger.warn({ error: prError }, 'Failed to create PR');
                    prUrl = 'PR creation failed';
                }
            }
        }

        const result: CoderOutput = {
            prUrl,
            filesChanged,
            testsPassed: coderOutput.testsPassed ?? true,
            commitSha,
        };

        const durationMs = Date.now() - startTime;
        logActivityComplete('coder', 'executeCode', durationMs, true);

        return result;
    } catch (error) {
        const durationMs = Date.now() - startTime;
        logActivityComplete('coder', 'executeCode', durationMs, false);
        throw error;
    }
}

/**
 * Parse JSON from a potentially messy LLM response.
 */
function parseJsonFromResponse<T>(response: string): T {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        logger.warn({ response: response.slice(0, 500) }, 'No JSON found in Coder response');
        return {} as T;
    }

    try {
        return JSON.parse(jsonMatch[0]) as T;
    } catch {
        logger.warn({ json: jsonMatch[0].slice(0, 500) }, 'Invalid JSON in Coder response');
        return {} as T;
    }
}
