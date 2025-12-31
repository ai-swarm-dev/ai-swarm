'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface ConversationSummary {
    tag: string;
    title: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
}

interface Conversation {
    tag: string;
    title: string;
    messages: Message[];
    planReady: boolean;
}

export default function ChatPage() {
    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load conversations on mount
    useEffect(() => {
        loadConversations();
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentConversation?.messages]);

    async function loadConversations() {
        try {
            const res = await fetch('/api/chat');
            const data = await res.json();
            setConversations(data.conversations || []);
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }

    async function selectConversation(tag: string) {
        try {
            setLoading(true);
            const res = await fetch(`/api/chat?tag=${encodeURIComponent(tag)}`);
            const data = await res.json();
            setCurrentConversation(data);
            setError(null);
        } catch (err) {
            setError('Failed to load conversation');
        } finally {
            setLoading(false);
        }
    }

    async function startNewConversation() {
        if (!input.trim()) return;

        try {
            setLoading(true);
            setError(null);

            // Create new conversation
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'new', message: input }),
            });
            const newConv = await res.json();

            setCurrentConversation({
                tag: newConv.tag,
                title: newConv.title,
                messages: [],
                planReady: false,
            });

            // Send first message to Planner
            await sendMessage(newConv.tag, input);

            // Refresh conversation list
            await loadConversations();
            setInput('');
        } catch (err) {
            setError('Failed to start conversation');
        } finally {
            setLoading(false);
        }
    }

    async function sendMessage(tag: string, message: string) {
        try {
            setLoading(true);
            setError(null);

            // Add user message optimistically
            setCurrentConversation((prev) => prev ? {
                ...prev,
                messages: [...prev.messages, {
                    role: 'user' as const,
                    content: message,
                    timestamp: new Date().toISOString(),
                }],
            } : null);

            // Send to Planner
            const res = await fetch('/api/chat/planner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag, message }),
            });

            if (!res.ok) {
                // FIX: Added more descriptive error handling for API failures
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${res.status}`);
            }

            const data = await res.json();
            setCurrentConversation(data.conversation);
        } catch (err) {
            // FIX: Specific message for potential timeouts
            const msg = err instanceof Error ? err.message : 'Failed to send message';
            setError(msg.includes('504') || msg.includes('timeout')
                ? 'Planner is taking too long to respond. The task might still be processing, please refresh in a moment.'
                : msg);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!input.trim() || loading) return;

        if (currentConversation) {
            await sendMessage(currentConversation.tag, input);
            setInput('');
        } else {
            await startNewConversation();
        }
    }

    async function createTask() {
        if (!currentConversation) return;

        // Find the plan JSON in messages
        const planMessage = currentConversation.messages
            .filter(m => m.role === 'assistant')
            .reverse()
            .find(m => {
                try {
                    JSON.parse(m.content);
                    return true;
                } catch {
                    return false;
                }
            });

        if (!planMessage) {
            setError('No plan found in conversation');
            return;
        }

        try {
            const plan = JSON.parse(planMessage.content);

            // Create task via workflows API
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: {
                        id: `task-${Date.now()}`,
                        title: currentConversation.title,
                        context: currentConversation.messages
                            .filter(m => m.role === 'user')
                            .map(m => m.content)
                            .join('\n'),
                        plan,
                        createdAt: new Date().toISOString(),
                    },
                    skipApproval: true,
                    notifyOnComplete: true,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to create task');
            }

            const data = await res.json();
            router.push(`/workflows/${data.workflowId}`);
        } catch (err) {
            setError('Failed to create task');
        }
    }

    function newConversation() {
        setCurrentConversation(null);
        setInput('');
        setError(null);
    }

    async function deleteChat(tag: string) {
        if (!confirm('Are you sure you want to delete this conversation?')) return;

        try {
            setLoading(true);
            const res = await fetch(`/api/chat?tag=${encodeURIComponent(tag)}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete conversation');

            // Reset UI
            if (currentConversation?.tag === tag) {
                newConversation();
            }

            // Refresh list
            await loadConversations();
        } catch (err) {
            setError('Failed to delete conversation');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col">
            {/* Header with conversation selector */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">Chat with Planner</h1>
                <div className="flex items-center gap-3">
                    <select
                        value={currentConversation?.tag || ''}
                        onChange={(e) => e.target.value ? selectConversation(e.target.value) : newConversation()}
                        className="px-3 py-2 bg-swarm-bg border border-swarm-border rounded-md text-sm focus:border-swarm-blue focus:outline-none"
                    >
                        <option value="">New Conversation</option>
                        {conversations.map((conv) => (
                            <option key={conv.tag} value={conv.tag}>
                                {conv.title} ({conv.messageCount} messages)
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={newConversation}
                        className="btn btn-ghost text-sm"
                    >
                        + New
                    </button>
                    {currentConversation && (
                        <button
                            onClick={() => deleteChat(currentConversation.tag)}
                            className="p-2 text-swarm-muted hover:text-red-400 transition-colors"
                            title="Delete Chat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Error display */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-md">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto card p-4 space-y-4">
                {!currentConversation && (
                    <div className="text-center text-swarm-muted py-8">
                        <p className="text-lg mb-2">Start a conversation with Planner</p>
                        <p className="text-sm">Describe your task and I&apos;ll ask clarifying questions until we have a solid plan.</p>
                    </div>
                )}

                {currentConversation?.messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg px-4 py-3 ${msg.role === 'user'
                                ? 'bg-swarm-blue text-white'
                                : 'bg-swarm-card border border-swarm-border'
                                }`}
                        >
                            <div className="text-xs opacity-70 mb-1">
                                {msg.role === 'user' ? 'You' : '🧠 Planner'}
                            </div>
                            <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-swarm-card border border-swarm-border rounded-lg px-4 py-3">
                            <div className="text-xs opacity-70 mb-1">🧠 Planner</div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-swarm-blue rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-swarm-blue rounded-full animate-bounce [animation-delay:0.1s]" />
                                <div className="w-2 h-2 bg-swarm-blue rounded-full animate-bounce [animation-delay:0.2s]" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="mt-4">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={currentConversation ? "Reply to Planner..." : "Describe your task..."}
                        disabled={loading}
                        className="flex-1 px-4 py-3 bg-swarm-bg border border-swarm-border rounded-md focus:border-swarm-blue focus:outline-none disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="btn btn-primary px-6"
                    >
                        {loading ? '...' : 'Send'}
                    </button>
                </form>

                {/* Action buttons */}
                <div className="flex justify-end mt-3 gap-3">
                    {currentConversation?.planReady && (
                        <button
                            onClick={createTask}
                            className="btn btn-primary"
                        >
                            ✓ Create Task from Plan
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
