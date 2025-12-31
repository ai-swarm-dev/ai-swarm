import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import { UserMenu } from '@/components/UserMenu';
import { SwarmStatus } from '@/components/SwarmStatus';
import { ServiceLinks } from '@/components/ServiceLinks';

export const metadata: Metadata = {
    title: 'AI Swarm - Orchestration Portal',
    description: 'Real-time monitoring and control for your AI agent swarm',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="min-h-screen">
                <Providers>
                    <header className="bg-swarm-card border-b border-swarm-border">
                        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🤖</span>
                                <h1 className="text-xl font-semibold">
                                    <span className="bg-gradient-to-r from-swarm-blue to-swarm-purple bg-clip-text text-transparent">
                                        AI Swarm
                                    </span>
                                    {' '}Portal
                                </h1>
                            </div>
                            <nav className="flex items-center gap-4">
                                <a href="/" className="text-swarm-muted hover:text-swarm-text transition-colors">
                                    Dashboard
                                </a>
                                <a href="/workflows" className="text-swarm-muted hover:text-swarm-text transition-colors">
                                    Workflows
                                </a>
                                <a href="/submit" className="text-swarm-muted hover:text-swarm-text transition-colors">
                                    Chat
                                </a>
                                <div className="h-4 w-px bg-swarm-border" />
                                <div className="h-4 w-px bg-swarm-border" />
                                <ServiceLinks />
                                <div className="h-4 w-px bg-swarm-border" />
                                <SwarmStatus />
                                <div className="h-4 w-px bg-swarm-border" />
                                <UserMenu />
                            </nav>
                        </div>
                    </header>
                    <main className="max-w-7xl mx-auto px-4 py-8">
                        {children}
                    </main>
                    <footer className="border-t border-swarm-border mt-auto py-4 text-center text-swarm-muted text-sm">
                        AI Swarm v2.0 • Powered by Temporal.io
                    </footer>
                </Providers>
            </body>
        </html>
    );
}
