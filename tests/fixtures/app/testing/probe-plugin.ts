import type { Plugin } from "vite"

/**
 * Wraps the internal `setupNuxt` of `@nuxt/test-utils` to count startups per environment window.
 *
 * `PROBE_STARTUP` changes the first startup attempt of a worker:
 * - `fail-before`: throw before the app is created;
 * - `fail-after`: throw after the app is created;
 * - `fail-rollback`: throw after the app is created and make its unmount throw too;
 * - `fail-plugin`, `fail-plugin-pre`: handled by the fixture's `probe-failure` plugins, which Nuxt catches;
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
  if (firstAttempt && mode === "fail-rollback") {
    useNuxtApp().vueApp.unmount = () => {
      throw new Error("probe: unmount failed")
    }
  }
  if (firstAttempt && (mode === "fail-after" || mode === "fail-rollback")) {
    throw new Error("probe: startup failed after app creation")
  }
  return result
}
`)
    },
  }
}

/**
 * Replaces the `@nuxt/test-utils` runtime entry with the lifecycle of https://github.com/nuxt/test-utils/pull/1821
 * (reviewed head fbdf0c543adeada19843bbf88103fcec1f2149bd), simulating a release with native app reuse.
 */
export function nativeReuseEntryPlugin(): Plugin {
  return {
    name: "fixture:native-reuse-entry",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\?.*$/, "").endsWith("/@nuxt/test-utils/dist/runtime/entry.mjs")) return
      return `
import { setupNuxt } from "./shared/nuxt.mjs"
import { beforeAll, vi } from "vitest"
import { tryUseNuxtApp } from "#imports"

if (typeof window !== "undefined") {
  const win = window
  if (win.__NUXT_VITEST_ENVIRONMENT__ && !win.__NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__) {
    if (!tryUseNuxtApp()) {
      vi.resetModules()
    }
    beforeAll(async () => {
      win.__NUXT_VITEST_ENVIRONMENT_PROMISE__ ??= setupNuxt().catch((err) => {
        tryUseNuxtApp()?.vueApp?.unmount()
        delete win.__NUXT_VITEST_ENVIRONMENT_PROMISE__
        throw err
      })
      await win.__NUXT_VITEST_ENVIRONMENT_PROMISE__
    })
  }
}

export {}
`
    },
  }
}
