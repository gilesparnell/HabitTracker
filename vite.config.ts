import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }
const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()

export default defineConfig({
  define: {
    __APP_SEMVER__: JSON.stringify(pkg.version),
    __APP_VERSION__: JSON.stringify(sha),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
