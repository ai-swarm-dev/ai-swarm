/**
 * AI Swarm v2 - Temporal Worker
 *
 * Main entry point for the Temporal worker that processes workflows and activities.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { logger } from '@ai-swarm/shared';
import * as activities from '@ai-swarm/workflows/activities';
import { initTelemetry, shutdownTelemetry } from './telemetry.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = {
    temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'ai-swarm',
    taskQueue: process.env.TASK_QUEUE || 'ai-swarm-tasks',
    maxConcurrentActivities: parseInt(process.env.MAX_CONCURRENT_ACTIVITIES || '10', 10),
    maxConcurrentWorkflows: parseInt(process.env.MAX_CONCURRENT_WORKFLOWS || '5', 10),
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    logger.info({ config }, 'Starting AI Swarm Worker');

    // Initialize OpenTelemetry
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        await initTelemetry();
        logger.info('OpenTelemetry initialized');
    }

    // Connect to Temporal
    const connection = await NativeConnection.connect({
        address: config.temporalAddress,
    });

    logger.info({ address: config.temporalAddress }, 'Connected to Temporal');

    // Resolve workflows path for bundling
    // In ESM, we need to provide the path to the compiled workflows
    const workflowsPath = resolve(__dirname, '../../workflows/dist/workflows/index.js');

    // Create worker
    const worker = await Worker.create({
        connection,
        namespace: config.namespace,
        taskQueue: config.taskQueue,
        workflowsPath,
        activities,
        maxConcurrentActivityTaskExecutions: config.maxConcurrentActivities,
        maxConcurrentWorkflowTaskExecutions: config.maxConcurrentWorkflows,
        shutdownGraceTime: '30s',
    });

    logger.info(
        {
            namespace: config.namespace,
            taskQueue: config.taskQueue,
            maxActivities: config.maxConcurrentActivities,
            maxWorkflows: config.maxConcurrentWorkflows,
        },
        'Worker created, starting to poll for tasks'
    );

    // Handle shutdown signals
    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Received shutdown signal');
        await worker.shutdown();
        await connection.close();
        // FIX: Ensure telemetry is flushed before exit
        if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
            await shutdownTelemetry();
        }
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Run worker
    await worker.run();
}

main().catch((error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Worker failed to start');
    process.exit(1);
});

