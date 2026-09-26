// Fails the first startup attempt of a worker in a plugin when PROBE_STARTUP is "fail-plugin".
export default defineNuxtPlugin(() => {
  if (__PROBE_STARTUP__ === "fail-plugin" && globalThis.__startupAttempts === 1) {
    throw new Error("probe: plugin failed")
  }
})
