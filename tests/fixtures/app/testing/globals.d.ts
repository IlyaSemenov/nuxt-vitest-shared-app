declare global {
  interface Window {
    __startupProbe?: { startups: number }
    __pings?: number
  }
  // oxlint-disable-next-line no-var -- global declarations require var
  var __startupAttempts: number | undefined
  const __PROBE_STARTUP__: string
}

export {}
