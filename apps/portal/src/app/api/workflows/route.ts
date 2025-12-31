import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTemporalClient } from '@/lib/temporal';


export async function POST(request: NextRequest) {
    // Check for authorization session
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { task, skipApproval, notifyOnComplete } = body;

        if (!task || !task.title) {
            return NextResponse.json(
                { error: 'Task title is required' },
                { status: 400 }
            );
        }

        const client = await getTemporalClient();

        const workflowId = `develop-${task.id || Date.now()}`;

        const handle = await client.workflow.start('developFeature', {
            taskQueue: 'ai-swarm-tasks',
            workflowId,
            args: [
                {
                    task: {
                        ...task,
                        createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
                    },
                    skipApproval: skipApproval ?? false,
                    notifyOnComplete: notifyOnComplete ?? true,
                },
            ],
        });

        return NextResponse.json({
            success: true,
            workflowId: handle.workflowId,
            runId: handle.firstExecutionRunId,
        });
    } catch (error) {
        console.error('Failed to start workflow:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to start workflow' },
            { status: 500 }
        );
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const client = await getTemporalClient();
        const workflows: any[] = [];

        const iterator = client.workflow.list({
            query: 'ORDER BY StartTime DESC',
        });

        let count = 0;
        for await (const wf of iterator) {
            if (count >= 50) break;
            // FIX: Map status Enum to string
            const status = (wf.status as any).name || 'UNKNOWN';

            workflows.push({
                workflowId: wf.workflowId,
                runId: wf.runId,
                type: wf.type,
                status: status,
                startTime: wf.startTime,
            });
            count++;
        }

        return NextResponse.json({ workflows });
    } catch (error) {
        console.error('Failed to list workflows:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to list workflows' },
            { status: 500 }
        );
    }
}
