/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['@temporalio/client'],
    },
    output: 'standalone',
};

module.exports = nextConfig;
