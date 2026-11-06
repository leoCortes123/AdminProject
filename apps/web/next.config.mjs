const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // BFF fino: el navegador solo habla con :3000; las llamadas a la API se
  // proxian (cookies first-party). La API sigue siendo la autoridad de auth.
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${API_INTERNAL_URL}/api/auth/:path*` },
      { source: '/api/v1/:path*', destination: `${API_INTERNAL_URL}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
