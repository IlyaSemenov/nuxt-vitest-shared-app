// Fails the first startup attempt of a worker in this plugin when PROBE_STARTUP is "fail-plugin", or before the app is mounted when it is "fail-mount".
export default defineNuxtPlugin((nuxtApp) => {
  if (globalThis.__startupAttempts !== 1) return
  if (__PROBE_STARTUP__ === "fail-plugin") throw new Error("probe: plugin failed")
  if (__PROBE_STARTUP__ === "fail-mount") {
    nuxtApp.hook("app:beforeMount", () => {
      throw new Error("probe: mount failed")
    })
  }
})
