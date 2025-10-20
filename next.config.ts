
import type { NextConfig } from "next";

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
    }
];

const nextConfig: NextConfig = {
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
        port: '',
        pathname: '/',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
