'use client';

import { useState, useEffect } from 'react';

interface SwarmStatusData {
    status: 'running' | 'paused';
    paused: boolean;
    pausedAt: string | null;
}

export function SwarmStatus() {
    const [status, setStatus] = useState<SwarmStatusData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        fetchStatus();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    async function fetchStatus() {
        try {
            const res = await fetch('/api/swarm');
            const data = await res.json();
            setStatus(data);
        } catch (err) {
            console.error('Failed to fetch swarm status:', err);
        }
    }

    async function toggleStatus() {
        if (!status) return;

        if (!status.paused && !showConfirm) {
            setShowConfirm(true);
            return;
        }

        try {
            setLoading(true);
            setShowConfirm(false);

            const res = await fetch('/api/swarm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: status.paused ? 'resume' : 'pause',
                }),
            });

            const data = await res.json();
            setStatus({
                status: data.status,
                paused: data.status === 'paused',
                pausedAt: data.status === 'paused' ? new Date().toISOString() : null,
            });
        } catch (err) {
            console.error('Failed to toggle swarm status:', err);
        } finally {
            setLoading(false);
        }
    }

    if (!status) {
        return (
            <div className="flex items-center gap-2 text-swarm-muted text-sm">
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                Loading...
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={toggleStatus}
                disabled={loading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status.paused
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    } disabled:opacity-50`}
            >
                <div
                    className={`w-2 h-2 rounded-full ${status.paused ? 'bg-red-500' : 'bg-green-500'
                        }`}
                />
                {loading ? '...' : status.paused ? 'Paused' : 'Active'}
            </button>

            {/* Confirmation dialog */}
            {showConfirm && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowConfirm(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-swarm-card border border-swarm-border rounded-md shadow-lg z-20 p-4">
                        <p className="text-sm font-medium mb-2">Pause Swarm?</p>
                        <p className="text-xs text-swarm-muted mb-4">
                            This will stop all new tasks from being processed.
                            Running tasks will complete.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-3 py-1.5 text-sm border border-swarm-border rounded hover:bg-swarm-bg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={toggleStatus}
                                className="flex-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                            >
                                Pause
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
