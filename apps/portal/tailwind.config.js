/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'swarm-bg': '#0d1117',
                'swarm-card': '#161b22',
                'swarm-border': '#30363d',
                'swarm-text': '#e6edf3',
                'swarm-muted': '#7d8590',
                'swarm-green': '#3fb950',
                'swarm-red': '#f85149',
                'swarm-blue': '#58a6ff',
                'swarm-purple': '#a371f7',
                'swarm-yellow': '#d29922',
            },
        },
    },
    plugins: [],
};
