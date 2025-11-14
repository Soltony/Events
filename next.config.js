
/** @type {import('next').NextConfig} */

const path = require('path');

// ✅ Updated Content Security Policy
const csp = [
  "default-src 'self'",
  // Allow inline scripts, eval for specific libraries, and data blobs
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:",
  // Allow inline styles for component libraries like ShadCN
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://placehold.co https://storage.googleapis.com https://picsum.photos",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://nominatim.openstreetmap.org",
  "media-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

// ✅ Updated security headers, now the single source of truth
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
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
];

const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
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
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  poweredByHeader: false,
  serverActions: {
    bodySizeLimit: "10mb",
  },
  env: {
    NEXT_PUBLIC_NIB_ACCOUNT_NO: process.env.NIB_ACCOUNT_NO,
    NEXT_PUBLIC_NIB_COMPANY_NAME: process.env.NIB_COMPANY_NAME,
    NEXT_PUBLIC_NIB_PAYMENT_KEY: process.env.NIB_PAYMENT_KEY,
    NEXT_PUBLIC_NIB_PAYMENT_URL: process.env.NIB_PAYMENT_URL,
    NEXT_PUBLIC_APP_URL: process.env.APP_URL,
  },
};

module.exports = nextConfig;
