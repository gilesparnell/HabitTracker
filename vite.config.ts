import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
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
  plugins: [
    {
      name: 'sw-build-id',
      generateBundle() {
        // Replace BUILD_ID placeholder in service worker
        const swPath = 'public/sw.js'
        let swCode = readFileSync(swPath, 'utf8')
        swCode = swCode.replace('__HT_BUILD_ID__', sha)
        writeFileSync(swPath, swCode)
      },
    },
  ],
})
