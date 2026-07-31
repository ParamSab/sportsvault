import withPWAInit from '@ducanh2912/next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const withPWA = withPWAInit({
    dest: 'public',
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    disable: isDev,
    workboxOptions: {
        disableDevLogs: true,
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        // Universal Links: Apple fetches this well-known path; serve it from the
        // AASA route so it gets a proper application/json content type.
        return [
            { source: '/.well-known/apple-app-site-association', destination: '/api/aasa' },
        ];
    },
};

// next-pwa injects a webpack config, which Next 16's default Turbopack dev
// server rejects. Only wrap with the PWA plugin for production builds
// (which run with --webpack); keep dev on clean Turbopack.
export default isDev ? nextConfig : withPWA(nextConfig);
