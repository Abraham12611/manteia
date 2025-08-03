/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@suiet/wallet-kit"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;