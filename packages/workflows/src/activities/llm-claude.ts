/**
 * AI Swarm v3.0.0 - Claude Code Wrapper
 *
 * This activity handles communication with Claude Code for coding tasks.
 * Supports both Z.ai API key and Pro/Max OAuth authentication modes.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import {
    logger,
    logActivityStart,
    logActivityComplete,
    promptService,
    systemConfigService,
    ClaudeAuthMode,
} from '@ai-swarm/shared';

const execAsync = promisify(exec);

/**
 * Check if Claude OAuth session is valid by examining auth files
 */
async function checkClaudeAuthStatus(): Promise<boolean> {
    const claudeDir = path.join(process.env.HOME || '/root', '.claude');
    try {
        // Check for credentials file that OAuth login creates
        const credentialsPath = path.join(claudeDir, 'credentials.json');
        await fs.access(credentialsPath);

        // Read and validate credentials exist and aren't empty
        const credentialsData = await fs.readFile(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsData);

        // Basic validation - credentials file should have some content
        if (credentials && Object.keys(credentials).length > 0) {
            logger.debug('Claude OAuth credentials file exists and is valid');
            return true;
        }
    } catch (err) {
        logger.debug({ err }, 'Claude OAuth credentials check failed');
    }
    return false;
}

export interface ClaudeCodeInput {
    task: string;
    projectDir: string;
    filesToModify?: string[];
    context?: string;
    /** Optional role - if 'planner', skip loading coder prompt since task already contains planner prompt */
    role?: 'coder' | 'planner';
}

export interface ClaudeCodeOutput {
    success: boolean;
    stdout: string;
    stderr: string;
    error?: string;
}

/**
 * Execute a task using Claude Code.
 */
export async function executeClaudeCode(input: ClaudeCodeInput): Promise<ClaudeCodeOutput> {
    const startTime = Date.now();
    logActivityStart('coder', 'executeClaudeCode', { projectDir: input.projectDir });

    try {
        // 0. Get auth mode from database (falls back to env var, then 'oauth')
        const authMode: ClaudeAuthMode = await systemConfigService.getClaudeAuthMode();
        logger.info({ authMode }, 'Claude Code authentication mode');

        // 1. Ensure .claude directory exists
        const claudeDir = path.join(process.env.HOME || '/root', '.claude');
        await fs.mkdir(claudeDir, { recursive: true });

        // 2. Auth mode specific setup
        const zaiApiKey = await systemConfigService.getZaiApiKey();

        if (authMode === 'zai') {
            // Z.ai mode: Initialize settings from template if not present
            const settingsPath = path.join(claudeDir, 'settings.json');
            try {
                await fs.access(settingsPath);
            } catch {
                const templatePath = '/opt/ai-swarm/templates/claude-settings.json';
                try {
                    let template = await fs.readFile(templatePath, 'utf8');
                    template = template.replace(/\${Z_AI_API_KEY}/g, zaiApiKey || '');
                    await fs.writeFile(settingsPath, template);
                    logger.info('Initialized Claude Code settings from template (Z.ai mode)');
                } catch (err) {
                    logger.warn({ err }, 'Failed to initialize Claude Code settings from template');
                }
            }
        } else {
            // OAuth mode: Check if authenticated
            const isAuthenticated = await checkClaudeAuthStatus();
            if (!isAuthenticated) {
                const errorMsg = 'Claude OAuth session not found or expired. Run ./auth-claude.sh to authenticate workers.';
                logger.error(errorMsg);
                return {
                    success: false,
                    stdout: '',
                    stderr: errorMsg,
                    error: errorMsg,
                };
            }
            logger.info('OAuth mode: Using existing Claude authentication');
        }

        // 3. Create AI Swarm identity file in worktree
        const worktreeClaudeDir = path.join(input.projectDir, '.claude');
        await fs.mkdir(worktreeClaudeDir, { recursive: true });
        const identityDestPath = path.join(worktreeClaudeDir, 'ai-swarm.local.md');

        try {
            // First try fetching from DB (modifiable)
            const identityContent = await promptService.getActivePrompt('claude-identity');
            await fs.writeFile(identityDestPath, identityContent);
            logger.info('Loaded Claude identity prompt from database');
        } catch (dbErr) {
            logger.debug({ err: dbErr }, 'Failed to load identity from DB, trying file fallback');

            // Fallback to file template
            const identityTemplatePath = '/opt/ai-swarm/templates/ai-swarm.local.md';
            try {
                const identityTemplate = await fs.readFile(identityTemplatePath, 'utf8');
                await fs.writeFile(identityDestPath, identityTemplate);
                logger.info({ destPath: identityDestPath }, 'Copied AI Swarm identity template from file (fallback)');
            } catch (fsErr) {
                logger.warn({ fsErr }, 'Failed to copy AI Swarm identity template - using inline fallback');
                // Create minimal identity to avoid errors
                await fs.writeFile(identityDestPath, '# AI Swarm Identity\nYou are an automated agent.');
            }
        }

        // 4. Load coder-specific prompt (skip for planner role since task already contains planner prompt)
        let coderPrompt = '';
        if (input.role !== 'planner') {
            const coderPromptPath = '/opt/ai-swarm/prompts/coder.md';
            try {
                coderPrompt = await fs.readFile(coderPromptPath, 'utf8');
                logger.info('Loaded coder role prompt');
            } catch (err) {
                logger.warn({ err }, 'Failed to load coder prompt - using minimal fallback');
                coderPrompt = 'You are the Coder agent. Implement the plan exactly as specified.';
            }
        } else {
            logger.info('Planner role - skipping coder prompt (task already contains planner prompt)');
        }

        // 5. Construct Claude Code command arguments
        // Note: We use stdin piping for the prompt to avoid E2BIG errors with large prompts
        const args = [
            '-p',
            '--output-format', 'json',
            '--dangerously-skip-permissions',
        ];

        // Build the full task with role-specific prompt
        let fullTask = coderPrompt ? `${coderPrompt}\n\n---\n\n${input.task}` : input.task;
        if (input.context) {
            fullTask = `${fullTask}\n\nContext:\n${input.context}`;
        }

        logger.info({ projectDir: input.projectDir, promptLength: fullTask.length }, 'Executing Claude Code');

        const stdout: string[] = [];
        const stderr: string[] = [];

        const child = spawn('claude', args, {
            cwd: input.projectDir,
            env: {
                ...process.env,
                Z_AI_API_KEY: zaiApiKey || process.env.Z_AI_API_KEY,
            },
            // Use 'pipe' for stdin to pass large prompts (avoids E2BIG error)
            // See CLAUDE_CLI.md: "cat error.log | claude -p 'Analyze this error log'"
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Write prompt to stdin and close to signal end of input
        child.stdin.write(fullTask);
        child.stdin.end();

        child.stdout.on('data', (data) => stdout.push(data.toString()));
        child.stderr.on('data', (data) => stderr.push(data.toString()));

        const exitCode = await new Promise<number>((resolve) => {
            child.on('close', resolve);
        });

        const durationMs = Date.now() - startTime;

        if (exitCode !== 0) {
            logActivityComplete('coder', 'executeClaudeCode', durationMs, false);
            const errorOutput = stderr.join('') || stdout.join('');
            logger.error({ exitCode, error: errorOutput }, 'Claude Code execution failed');
            return {
                success: false,
                stdout: stdout.join(''),
                stderr: stderr.join(''),
                error: `Claude Code exited with code ${exitCode}: ${errorOutput}`,
            };
        }

        logActivityComplete('coder', 'executeClaudeCode', durationMs, true);

        return {
            success: true,
            stdout: stdout.join(''),
            stderr: stderr.join(''),
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        logActivityComplete('coder', 'executeClaudeCode', durationMs, false);

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Claude Code execution failed');

        return {
            success: false,
            stdout: '',
            stderr: errorMessage,
            error: errorMessage,
        };
    }
}
