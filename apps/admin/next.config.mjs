/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@iloja/ui', '@iloja/types', '@iloja/sdk'],
};

export default nextConfig;
