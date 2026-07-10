/// <reference types="vite/client" />

declare const __APP_SEMVER__: string
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

declare module '*?raw' {
  const content: string
  export default content
}
