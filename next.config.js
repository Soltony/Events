
/** @type {import('next').NextConfig} */
const path = require('path');

// Content-Security-Policy is NOT set here: it is generated per request in
// src/middleware.ts so every response gets a fresh script/style nonce.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig = {
  output: "standalone",           // ✅ standalone build
  reactStrictMode: true,          // recommended
  experimental: {
    serverActions: {
       bodySizeLimit: '10mb',
    },            // ✅ must be an object, not boolean
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  poweredByHeader: false,
};

module.exports = nextConfig;
