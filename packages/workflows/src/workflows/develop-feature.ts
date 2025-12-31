/**
 * AI Swarm v2 - Develop Feature Workflow
 *
 * Main workflow that orchestrates the full development cycle:
 * Planner → Coder → Deployer → Notification
 *
 * AUTO-APPROVAL MODE: Skips human approval by default for autonomous operation.
 * Uses retry-once logic for test failures before creating fix tasks.
 */

import {
    proxyActivities,
    defineSignal,
    setHandler,
    condition,
    sleep,
    workflowInfo,
} from '@temporalio/workflow';

import type { Task, ImplementationPlan, CoderOutput, DeployerOutput } from '@ai-swarm/shared';
import type * as activities from '../activities/index.js';

// =============================================================================
// ACTIVITY PROXIES
// =============================================================================

const {
    planTask,
    executeCode,
    verifyBuild,
    sendNotification,
    rollbackCommit,
    createFixTask,
    checkFixTaskLoop,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: '15 minutes',
    retry: {
        maximumAttempts: 3,
        initialInterval: '5s',
        backoffCoefficient: 2,
        maximumInterval: '2m',
    },
});

// =============================================================================
// SIGNALS
// =============================================================================

/**
 * Signal to approve or reject the implementation plan.
 */
export const approvalSignal = defineSignal<[boolean, string?]>('approval');

/**
 * Signal to cancel the workflow.
 */
export const cancelSignal = defineSignal('cancel');

// =============================================================================
// WORKFLOW STATE
// =============================================================================

interface WorkflowState {
    phase: 'planning' | 'awaiting_approval' | 'coding' | 'deploying' | 'retrying' | 'complete' | 'failed' | 'cancelled';
    plan?: ImplementationPlan;
    prUrl?: string;
    commitSha?: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    approvalComment?: string;
    error?: string;
    retryCount: number;
}

// =============================================================================
// MAIN WORKFLOW
// =============================================================================

export interface DevelopFeatureInput {
    task: Task;
    skipApproval?: boolean;  // Default: TRUE for autonomous mode
    notifyOnComplete?: boolean;
    isFixTask?: boolean;
    originalTaskId?: string;
}

export interface DevelopFeatureOutput {
    status: 'completed' | 'failed' | 'cancelled' | 'fix_task_created';
    prUrl?: string;
    plan?: ImplementationPlan;
    commitSha?: string;
    error?: string;
    fixTaskId?: string;
}

/**
 * Develop Feature Workflow
 *
 * Orchestrates the full development cycle with autonomous operation.
 * Auto-approves by default. Retries once on failure, then creates fix task.
 */
export async function developFeature(
    input: DevelopFeatureInput
): Promise<DevelopFeatureOutput> {
    // AUTO-APPROVAL: Default to true for autonomous operation
    const {
        task,
        skipApproval = true,  // Changed default to TRUE
        notifyOnComplete = true,
        isFixTask = false,
        originalTaskId,
    } = input;

    const { workflowId } = workflowInfo();

    // Workflow state
    const state: WorkflowState = {
        phase: 'planning',
        approvalStatus: 'pending',
        retryCount: 0,
    };

    let cancelled = false;

    // ==========================================================================
    // SIGNAL HANDLERS
    // ==========================================================================

    setHandler(approvalSignal, (approved: boolean, comment?: string) => {
        state.approvalStatus = approved ? 'approved' : 'rejected';
        state.approvalComment = comment;
    });

    setHandler(cancelSignal, () => {
        cancelled = true;
        state.phase = 'cancelled';
    });

    try {
        // ========================================================================
        // CHECK FOR LOOP (Fix tasks only)
        // ========================================================================
        if (isFixTask && originalTaskId) {
            const loopCheck = await checkFixTaskLoop(originalTaskId);
            if (loopCheck.isLoop) {
                // Escalate to human - don't create another fix task
                await sendNotification({
                    subject: `[AI Swarm] LOOP DETECTED: ${task.title}`,
                    body: `
Fix-task loop detected! Task has failed ${loopCheck.chainDepth} times.

**Original Task ID:** ${originalTaskId}
**Task:** ${task.title}
**Chain Depth:** ${loopCheck.chainDepth}

**Action Required:** Manual intervention needed. The automated fix attempts are failing repeatedly.

Please review the task and either:
1. Fix the underlying issue manually
2. Cancel the task chain
          `.trim(),
                    priority: 'high',
                });

                return {
                    status: 'failed',
                    error: `Fix-task loop detected after ${loopCheck.chainDepth} attempts. Escalated to human.`,
                };
            }
        }

        // ========================================================================
        // PHASE 1: PLANNING
        // ========================================================================
        state.phase = 'planning';

        const plan = await planTask(task);
        state.plan = plan;

        // Check for cancellation
        if (cancelled) {
            return { status: 'cancelled' };
        }

        // ========================================================================
        // PHASE 2: HUMAN APPROVAL (Skip in auto mode)
        // ========================================================================
        if (!skipApproval) {
            state.phase = 'awaiting_approval';

            // Notify user that plan is ready for review
            await sendNotification({
                subject: `[AI Swarm] Plan Ready: ${task.title}`,
                body: `
Implementation plan is ready for review.

**Task:** ${task.title}
**Workflow ID:** ${workflowId}

**Proposed Changes:**
${plan.proposedChanges.map((c) => `- ${c.action.toUpperCase()} ${c.path}: ${c.description}`).join('\n')}

**Verification Plan:**
${plan.verificationPlan}

**Estimated Effort:** ${plan.estimatedEffort}

Reply to this workflow to approve or reject.
        `.trim(),
                priority: 'high',
            });

            // Wait for approval (max 24 hours)
            const gotApproval = await condition(
                () => state.approvalStatus !== 'pending' || cancelled,
                '24h'
            );

            if (cancelled) {
                return { status: 'cancelled' };
            }

            if (!gotApproval || state.approvalStatus === 'pending') {
                state.phase = 'failed';
                state.error = 'Plan not approved within 24 hours';
                return {
                    status: 'failed',
                    plan,
                    error: state.error,
                };
            }

            if (state.approvalStatus === 'rejected') {
                state.phase = 'failed';
                state.error = `Plan rejected: ${state.approvalComment || 'No reason given'}`;
                return {
                    status: 'failed',
                    plan,
                    error: state.error,
                };
            }
        }

        // ========================================================================
        // PHASE 3: CODING
        // ========================================================================
        state.phase = 'coding';

        const coderResult: CoderOutput = await executeCode(plan);
        state.prUrl = coderResult.prUrl;
        state.commitSha = coderResult.commitSha;

        if (cancelled) {
            return { status: 'cancelled', prUrl: coderResult.prUrl };
        }

        // ========================================================================
        // PHASE 4: DEPLOYMENT VERIFICATION (with retry)
        // ========================================================================
        state.phase = 'deploying';

        let deployResult: DeployerOutput = await verifyBuild(coderResult.prUrl);

        // RETRY ONCE if tests fail
        if (!deployResult.buildSuccess || !deployResult.testsPassed) {
            state.phase = 'retrying';
            state.retryCount = 1;

            // Wait a bit and retry
            await sleep('30s');

            deployResult = await verifyBuild(coderResult.prUrl);
        }

        // If still failing after retry, create fix task
        if (!deployResult.buildSuccess || !deployResult.testsPassed) {
            state.phase = 'failed';
            state.error = `Build/test verification failed: ${deployResult.logs}`;

            // Create a fix task
            const fixResult = await createFixTask({
                originalTaskId: originalTaskId || task.id,
                originalTaskTitle: task.title,
                error: state.error,
                commitSha: coderResult.commitSha,
            });

            await sendNotification({
                subject: `[AI Swarm] Task Failed - Fix Task Created: ${task.title}`,
                body: `
Task failed verification. A fix task has been created.

**Original Task:** ${task.title}
**PR:** ${coderResult.prUrl}
**Error:** ${state.error}

**Fix Task ID:** ${fixResult.fixTaskId}
**Attempt:** ${fixResult.chainDepth}

The fix task will run automatically.
        `.trim(),
                priority: 'high',
            });

            return {
                status: 'fix_task_created',
                prUrl: coderResult.prUrl,
                plan,
                error: state.error,
                fixTaskId: fixResult.fixTaskId,
            };
        }

        // ========================================================================
        // PHASE 5: COMPLETION
        // ========================================================================
        state.phase = 'complete';

        if (notifyOnComplete) {
            await sendNotification({
                subject: `[AI Swarm] ✅ Task Complete: ${task.title}`,
                body: `
Task completed successfully!

**Task:** ${task.title}
**PR:** ${coderResult.prUrl}
**Files Changed:** ${coderResult.filesChanged.join(', ')}
**Tests Passed:** ✅ Yes
**Commit:** ${coderResult.commitSha}
${deployResult.deployedTo ? `**Deployed To:** ${deployResult.deployedTo}` : ''}
        `.trim(),
                priority: 'normal',
            });
        }

        return {
            status: 'completed',
            prUrl: coderResult.prUrl,
            plan,
            commitSha: coderResult.commitSha,
        };
    } catch (error) {
        state.phase = 'failed';
        state.error = error instanceof Error ? error.message : String(error);

        // Notify on failure
        await sendNotification({
            subject: `[AI Swarm] Task Failed: ${task.title}`,
            body: `
Task failed unexpectedly.

**Task:** ${task.title}
**Phase:** ${state.phase}
**Error:** ${state.error}
      `.trim(),
            priority: 'high',
        });

        return {
            status: 'failed',
            plan: state.plan,
            error: state.error,
        };
    }
}
