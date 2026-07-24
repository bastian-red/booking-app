/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@booking/shared'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
