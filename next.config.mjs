import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Worktree lives at <project>/.claude/worktrees/<name> — go up 3 levels to reach the project root
// where node_modules/next and pnpm-lock.yaml reside.
const projectRoot = path.resolve(__dirname, "..", "..", "..")

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: projectRoot,
  },
}

export default nextConfig
