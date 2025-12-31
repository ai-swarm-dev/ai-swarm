'use client';

interface AgentInfo {
    name: string;
    role: string;
    icon: string;
    description: string;
}

const agents: AgentInfo[] = [
    {
        name: 'Planner',
        role: 'Lead Architect',
        icon: '🧠',
        description: 'Creates implementation plans and orchestrates tasks',
    },
    {
        name: 'Coder',
        role: 'Senior Developer',
        icon: '💻',
        description: 'Implements code changes and creates PRs',
    },
    {
        name: 'Deployer',
        role: 'DevOps Engineer',
        icon: '🚀',
        description: 'Verifies builds and manages deployments',
    },
    {
        name: 'Supervisor',
        role: 'System Monitor',
        icon: '👁️',
        description: 'Monitors health and performs self-healing',
    },
];

export function AgentGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {agents.map((agent) => (
                <AgentCard key={agent.name} agent={agent} />
            ))}
        </div>
    );
}

function AgentCard({ agent }: { agent: AgentInfo }) {
    return (
        <div className="card group">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{agent.icon}</span>
                    <div>
                        <h3 className="font-medium">{agent.name}</h3>
                        <p className="text-xs text-swarm-muted">{agent.role}</p>
                    </div>
                </div>
                <span className="badge badge-running">Active</span>
            </div>
            <p className="text-sm text-swarm-muted">{agent.description}</p>

            {/* Activity indicator */}
            <div className="mt-4 flex items-center gap-2 text-xs text-swarm-muted">
                <div className="w-2 h-2 rounded-full bg-swarm-green animate-pulse" />
                <span>Processing tasks...</span>
            </div>
        </div>
    );
}
