// Fails the first startup attempt of a worker before the router plugin when PROBE_STARTUP is "fail-plugin-pre".
export default defineNuxtPlugin({
  enforce: "pre",
  setup() {
    if (__PROBE_STARTUP__ === "fail-plugin-pre" && globalThis.__startupAttempts === 1) {
      throw new Error("probe: pre plugin failed")
    }
  },
})
