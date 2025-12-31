/**
 * AI Swarm v2 - Core Type Definitions
 */

// =============================================================================
// TASK TYPES
// =============================================================================

export interface Task {
    id: string;
    title: string;
    context: string;
    acceptanceCriteria: string[];
    filesToModify: string[];
    priority: TaskPriority;
    createdAt: Date;
    metadata?: Record<string, unknown>;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// =============================================================================
// IMPLEMENTATION PLAN
// =============================================================================

export interface ImplementationPlan {
    taskId: string;
    proposedChanges: FileChange[];
    verificationPlan: string;
    estimatedEffort: string;
    dependencies?: string[];
}

export interface FileChange {
    path: string;
    action: 'create' | 'modify' | 'delete';
    description: string;
}

// =============================================================================
// AGENT TYPES
// =============================================================================

export type AgentRole = 'planner' | 'coder' | 'deployer' | 'supervisor';

export interface AgentResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    logs: LogEntry[];
    durationMs: number;
}

export interface LogEntry {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, unknown>;
}

// =============================================================================
// WORKFLOW TYPES
// =============================================================================

export interface WorkflowInput {
    task: Task;
    options?: WorkflowOptions;
}

export interface WorkflowOptions {
    skipApproval?: boolean;
    dryRun?: boolean;
    notifyOnComplete?: boolean;
}

export interface WorkflowResult {
    taskId: string;
    status: 'completed' | 'failed' | 'cancelled';
    prUrl?: string;
    error?: string;
    completedAt: Date;
}

// =============================================================================
// PLANNER TYPES
// =============================================================================

export interface PlannerOutput {
    proposedChanges: FileChange[];
    verificationPlan: string;
    estimatedEffort: string;
}

// =============================================================================
// CODER TYPES
// =============================================================================

export interface CoderOutput {
    prUrl: string;
    filesChanged: string[];
    testsPassed: boolean;
    commitSha: string;
}

// =============================================================================
// DEPLOYER TYPES
// =============================================================================

export interface DeployerOutput {
    buildSuccess: boolean;
    testsPassed: boolean;
    deployedTo: string | null;
    logs: string;
}

// =============================================================================
// SUPERVISOR TYPES
// =============================================================================

export interface SupervisorOutput {
    healthStatus: 'healthy' | 'degraded' | 'critical';
    actionsTaken: string[];
    escalated: boolean;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export interface NotificationInput {
    subject: string;
    body: string;
    priority?: 'low' | 'normal' | 'high';
}

// =============================================================================
// HEALTH CHECK TYPES
// =============================================================================

export interface HealthCheckResult {
    service: string;
    status: 'healthy' | 'unhealthy';
    latencyMs: number;
    message?: string;
}
