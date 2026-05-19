import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
loadEnvConfig(repoRoot, process.env.NODE_ENV !== 'production');

const backendInternal =
  process.env.BACKEND_INTERNAL_URL?.replace(/\/$/, '') || 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  // Dev uses `.next-dev` (see scripts/run-dev.mjs) so production `next build` cannot break dev.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  transpilePackages: ['@billing/shared'],
  // Avoid Next 15.5 devtools (segment-explorer-node) corrupting the client manifest on Windows.
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendInternal}/api/v1/:path*`,
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev && process.platform === 'win32') {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
