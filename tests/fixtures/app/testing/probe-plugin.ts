import type { Plugin } from "vite"

/**
 * Wraps the internal `setupNuxt` of `@nuxt/test-utils` to count startups per environment window.
 *
 * `PROBE_STARTUP` changes the first startup attempt of a worker:
 * - `fail-before`: throw before the app is created;
 * - `fail-after`: throw after the app is created;
 * - `fail-plugin`, `fail-plugin-pre`, `fail-mount`: handled by the fixture's `probe-failure` plugins, which Nuxt catches;
 * - `skip`: never create the app (every attempt).
 */
export function startupProbePlugin(): Plugin {
  const mode = JSON.stringify(process.env.PROBE_STARTUP ?? "")
  return {
    name: "fixture:startup-probe",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\?.*$/, "").endsWith("/@nuxt/test-utils/dist/runtime/shared/nuxt.mjs"))
        return
      return code.replace("async function setupNuxt(", "async function originalSetupNuxt(").concat(`
async function setupNuxt(...args) {
  window.__startupProbe ??= { startups: 0 }
  window.__startupProbe.startups++
  globalThis.__startupAttempts = (globalThis.__startupAttempts ?? 0) + 1
  const firstAttempt = globalThis.__startupAttempts === 1
  const mode = ${mode}
  if (mode === "skip") return
  if (firstAttempt && mode === "fail-before") throw new Error("probe: startup failed before app creation")
  const result = await originalSetupNuxt(...args)
  if (firstAttempt && mode === "fail-after") {
    throw new Error("probe: startup failed after app creation")
  }
  return result
}
`)
    },
  }
}
