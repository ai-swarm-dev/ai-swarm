import { getTemporalClient } from '@/lib/temporal';

interface Stats {
    running: number;
    completed: number;
    failed: number;
    pending: number;
}

export async function QuickStats() {
    let stats: Stats = { running: 0, completed: 0, failed: 0, pending: 0 };
    let connected = true;

    try {
        const client = await getTemporalClient();

        // Count running workflows
        const runningIterator = client.workflow.list({
            query: 'ExecutionStatus="Running"',
        });
        for await (const _ of runningIterator) {
            stats.running++;
            if (stats.running >= 100) break; // Cap for performance
        }

        // Count completed in last 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const completedIterator = client.workflow.list({
            query: `ExecutionStatus="Completed" AND CloseTime > "${oneDayAgo}"`,
        });
        for await (const _ of completedIterator) {
            stats.completed++;
            if (stats.completed >= 100) break;
        }

        // Count failed in last 24h
        const failedIterator = client.workflow.list({
            query: `ExecutionStatus="Failed" AND CloseTime > "${oneDayAgo}"`,
        });
        for await (const _ of failedIterator) {
            stats.failed++;
            if (stats.failed >= 100) break;
        }
    } catch (e) {
        connected = false;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
                label="Running"
                value={stats.running}
                icon="🔄"
                color="text-swarm-green"
                connected={connected}
            />
            <StatCard
                label="Completed (24h)"
                value={stats.completed}
                icon="✅"
                color="text-swarm-blue"
                connected={connected}
            />
            <StatCard
                label="Failed (24h)"
                value={stats.failed}
                icon="❌"
                color="text-swarm-red"
                connected={connected}
            />
            <StatCard
                label="Status"
                value={connected ? 'Connected' : 'Disconnected'}
                icon={connected ? '🟢' : '🔴'}
                color={connected ? 'text-swarm-green' : 'text-swarm-red'}
                connected={connected}
                isStatus
            />
        </div>
    );
}

interface StatCardProps {
    label: string;
    value: number | string;
    icon: string;
    color: string;
    connected: boolean;
    isStatus?: boolean;
}

function StatCard({ label, value, icon, color, connected, isStatus }: StatCardProps) {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <span className="text-2xl">{icon}</span>
                {!connected && !isStatus && (
                    <span className="text-xs text-swarm-muted">--</span>
                )}
            </div>
            <div className="mt-3">
                <p className={`text-2xl font-bold ${color}`}>
                    {connected || isStatus ? value : '--'}
                </p>
                <p className="text-sm text-swarm-muted">{label}</p>
            </div>
        </div>
    );
}
