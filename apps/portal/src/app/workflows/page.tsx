import { Suspense } from 'react';
import { WorkflowList } from '@/components/WorkflowList';

export const dynamic = 'force-dynamic';

export default function WorkflowsPage() {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">All Workflows</h1>
                <a href="/submit" className="btn btn-primary">
                    + New Task
                </a>
            </div>

            <Suspense fallback={<Loading />}>
                <WorkflowList limit={50} />
            </Suspense>
        </div>
    );
}

function Loading() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card animate-pulse h-20" />
            ))}
        </div>
    );
}
