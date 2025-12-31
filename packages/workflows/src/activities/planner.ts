/**
 * AI Swarm v2 - Planner Activity
 *
 * Creates implementation plans for tasks using Gemini CLI.
 */

import {
    Task,
    ImplementationPlan,
    PlannerOutput,
    invokeGeminiCLI,
    loadSystemPrompt,
    logger,
    logActivityStart,
    logActivityComplete,
} from '@ai-swarm/shared';

/**
 * Plan a task by analyzing requirements and creating an implementation plan.
 */
export async function planTask(task: Task): Promise<ImplementationPlan> {
    const startTime = Date.now();
    logActivityStart('planner', 'planTask', { taskId: task.id, title: task.title });

    try {
        const systemPrompt = loadSystemPrompt('planner');

        const prompt = `${systemPrompt}

## Task to Plan

**ID:** ${task.id}
**Title:** ${task.title}

**Context:**
${task.context}

**Acceptance Criteria:**
${(task.acceptanceCriteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n')}

**Files to Consider:**
${(task.filesToModify || []).length > 0 ? task.filesToModify.map((f) => `- ${f}`).join('\n') : 'Not specified - analyze the codebase to determine.'}

**Priority:** ${task.priority || 'medium'}

---

Analyze this task and create a detailed implementation plan. Return ONLY valid JSON.`;

        const response = await invokeGeminiCLI(prompt, {
            role: 'planner',
            cwd: process.env.PROJECT_DIR || '/project',
        });

        // Parse JSON from response
        const plannerOutput = parseJsonFromResponse<PlannerOutput>(response);

        const plan: ImplementationPlan = {
            taskId: task.id,
            proposedChanges: plannerOutput.proposedChanges,
            verificationPlan: plannerOutput.verificationPlan,
            estimatedEffort: plannerOutput.estimatedEffort,
        };

        const durationMs = Date.now() - startTime;
        logActivityComplete('planner', 'planTask', durationMs, true);

        return plan;
    } catch (error) {
        const durationMs = Date.now() - startTime;
        logActivityComplete('planner', 'planTask', durationMs, false);
        throw error;
    }
}

/**
 * Parse JSON from a potentially messy LLM response.
 */
function parseJsonFromResponse<T>(response: string): T {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        logger.error({ response: response.slice(0, 500) }, 'No JSON found in response');
        throw new Error('Failed to parse JSON from Planner response');
    }

    try {
        return JSON.parse(jsonMatch[0]) as T;
    } catch (error) {
        logger.error({ json: jsonMatch[0].slice(0, 500) }, 'Invalid JSON in response');
        throw new Error('Invalid JSON in Planner response');
    }
}
