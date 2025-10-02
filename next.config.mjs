/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {},
    images: {
        domains: ['storage.googleapis.com'],
    },
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals.push('canvas');
        } else {
            config.resolve.alias.canvas = false;
        }
        return config;
    },
};

export default nextConfig;