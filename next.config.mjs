/**
 * 运行时环境变量校验（T3 Stack 标准）
 */
await import("./src/env.mjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    /** `tsc` / `npm run lint` 需通过后再构建，避免静默类型错误 */
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
