import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Allowed emails (comma-separated in env)
const allowedEmails = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        }),
    ],

    callbacks: {
        async signIn({ user }) {
            // If no allowlist configured, allow all
            if (allowedEmails.length === 0) {
                return true;
            }

            // Check if user email is in allowlist
            const userEmail = user.email?.toLowerCase();
            if (userEmail && allowedEmails.includes(userEmail)) {
                return true;
            }

            // Deny access
            console.warn(`Access denied for email: ${user.email}`);
            return false;
        },

        async session({ session, token }) {
            // Add user ID to session
            if (session.user && token.sub) {
                (session.user as any).id = token.sub;
            }
            return session;
        },

        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },

    session: {
        strategy: 'jwt',
        maxAge: 7 * 24 * 60 * 60, // 7 days
    },

    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },

    secret: process.env.NEXTAUTH_SECRET,
};
