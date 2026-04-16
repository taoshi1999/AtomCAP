/**
 * 运行时环境变量校验（T3 Stack 标准）
 */
await import("./src/env.mjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
