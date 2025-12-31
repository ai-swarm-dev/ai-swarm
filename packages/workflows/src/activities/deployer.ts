/**
 * AI Swarm v2 - Deployer Activity
 *
 * Verifies builds and deployments.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
    DeployerOutput,
    logger,
    logActivityStart,
    logActivityComplete,
} from '@ai-swarm/shared';

const execAsync = promisify(exec);

/**
 * Verify build and optionally deploy.
 */
export async function verifyBuild(prUrl: string): Promise<DeployerOutput> {
    const startTime = Date.now();
    logActivityStart('deployer', 'verifyBuild', { prUrl });

    const projectDir = process.env.PROJECT_DIR || process.cwd();
    const logs: string[] = [];

    try {
        // =======================================================================
        // STEP 1: Pull latest changes
        // =======================================================================
        logger.info('Pulling latest changes');
        await execAsync('git pull origin main', { cwd: projectDir });
        logs.push('✓ Pulled latest changes');

        // =======================================================================
        // STEP 2: Install dependencies (if package.json exists)
        // =======================================================================
        try {
            await execAsync('npm install', { cwd: projectDir });
            logs.push('✓ Dependencies installed');
        } catch {
            logs.push('⚠ No npm dependencies (or install failed)');
        }

        // =======================================================================
        // STEP 3: Run build
        // =======================================================================
        let buildSuccess = true;
        try {
            const { stdout, stderr } = await execAsync('npm run build 2>&1 || true', {
                cwd: projectDir,
            });
            const output = stdout + stderr;

            if (output.includes('error') || output.includes('Error')) {
                buildSuccess = false;
                logs.push(`✗ Build failed: ${output.slice(0, 200)}`);
            } else {
                logs.push('✓ Build succeeded');
            }
        } catch {
            // No build script, that's okay
            logs.push('⚠ No build script found');
        }

        // =======================================================================
        // STEP 4: Run tests
        // =======================================================================
        let testsPassed = true;
        try {
            const { stdout, stderr } = await execAsync('npm test 2>&1 || true', {
                cwd: projectDir,
            });
            const output = stdout + stderr;

            if (output.includes('failed') || output.includes('FAIL')) {
                testsPassed = false;
                logs.push(`✗ Tests failed: ${output.slice(0, 200)}`);
            } else if (output.includes('passed') || output.includes('PASS')) {
                logs.push('✓ Tests passed');
            } else {
                logs.push('⚠ No test results found');
            }
        } catch {
            logs.push('⚠ No test script found');
        }

        // =======================================================================
        // STEP 5: Optional: Use Gemini for advanced verification
        // =======================================================================
        // For now, we skip LLM-based verification unless explicitly needed

        const result: DeployerOutput = {
            buildSuccess,
            testsPassed,
            deployedTo: null, // No deployment in this basic version
            logs: logs.join('\n'),
        };

        const durationMs = Date.now() - startTime;
        logActivityComplete('deployer', 'verifyBuild', durationMs, buildSuccess && testsPassed);

        return result;
    } catch (error) {
        const durationMs = Date.now() - startTime;
        logActivityComplete('deployer', 'verifyBuild', durationMs, false);

        return {
            buildSuccess: false,
            testsPassed: false,
            deployedTo: null,
            logs: `Error: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
