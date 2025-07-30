/** @type {import('next').NextConfig} */
const nextConfig = {
  // assetPrefix: "/exp4-static", // Commented out for local development
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
  },
}

export default nextConfig
