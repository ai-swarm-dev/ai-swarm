import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConversation, addMessage } from '@/lib/chat-storage';
const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();

// Planner system prompt
const PLANNER_SYSTEM = `You are Planner, the Lead Architect for AI Swarm.

Your job is to have a conversation with the user to understand their task requirements.
Ask clarifying questions until you have enough information to create a solid implementation plan.

When you have gathered enough information and are ready to create a plan, respond with ONLY valid JSON:
{
    "proposedChanges": [{ "path": "...", "action": "modify|create|delete", "description": "..." }],
    "verificationPlan": "How to test",
    "estimatedEffort": "X hours"
}

Until then, continue the conversation naturally. Be helpful and ask specific questions.`;

/**
 * Load project context from documentation
 */
async function loadProjectContext(): Promise<string> {
    try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        const projectDir = process.env.PROJECT_DIR || '/project';
        const contextFolder = process.env.CONTEXT_FOLDER || 'docs/context';
        const contextPath = path.join(projectDir, contextFolder, 'README.md');

        const content = await fs.readFile(contextPath, 'utf-8');
        return `\n\n## Project Context (${contextFolder}/README.md)\n${content}`;
    } catch (error) {
        console.warn('Could not load project context:', error);
        return '';
    }
}

/**
 * POST /api/chat/planner
 * Send message to Planner and get response
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { tag, message } = body;

        if (!tag || !message) {
            return NextResponse.json({ error: 'Tag and message required' }, { status: 400 });
        }

        // Get current conversation
        const conversation = await getConversation(session.user.email, tag);
        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Add user message
        await addMessage(session.user.email, tag, 'user', message);

        // Build conversation context
        const conversationHistory = conversation.messages
            .map((m) => `${m.role === 'user' ? 'USER' : 'PLANNER'}: ${m.content}`)
            .join('\n\n');

        // Load project context
        const projectContext = await loadProjectContext();

        const fullPrompt = `${PLANNER_SYSTEM}${projectContext}

## Conversation History
${conversationHistory}

USER: ${message}

PLANNER:`;

        // Use centralized invokeGeminiCLI from @ai-swarm/shared
        // This provides model cascade support, timeout handling, and memory safety.
        try {
            const { invokeGeminiCLI } = await import('@ai-swarm/shared');
            const projectDir = process.env.PROJECT_DIR || '/project';
            const response = await invokeGeminiCLI(fullPrompt, {
                role: 'planner',
                cwd: projectDir,
                timeout: 5 * 60 * 1000,
            });

            // Add assistant message
            const updatedConversation = await addMessage(
                session.user.email,
                tag,
                'assistant',
                response
            );

            return NextResponse.json({
                response,
                conversation: updatedConversation,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Gemini error:', errorMessage);

            return NextResponse.json(
                { error: 'Failed to get response from Planner' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Planner API error:', error);
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}
