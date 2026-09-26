// Replacement for the `@nuxt/test-utils` runtime entry that starts Nuxt once per environment.
//
// It follows the lifecycle of https://github.com/nuxt/test-utils/pull/1821 and, with the rest of `src/adapter/`, is removed once the supported `@nuxt/test-utils` versions reuse the app natively.
// The config wrapper uses it only for versions that start Nuxt in every file.

import { beforeAll, vi } from "vitest"

import { getStartupError } from "../runtime/startup-error"
import { SETUP_NUXT_ID } from "./setup-nuxt-id"

interface AdapterState {
  startup?: Promise<void>
  started?: boolean
}

const ADAPTER_KEY = Symbol.for("nuxt-vitest-shared-app:adapter")

type AdapterWindow = Window & {
  __NUXT__?: unknown
  __NUXT_VITEST_ENVIRONMENT__?: boolean
  [ADAPTER_KEY]?: AdapterState
}

if (typeof window !== "undefined" && (window as AdapterWindow).__NUXT_VITEST_ENVIRONMENT__) {
  const win = window as AdapterWindow
  const state = (win[ADAPTER_KEY] ??= {})

  // Only the first file of an environment, or the next file after a failed startup, starts from a clean module graph.
  if (!state.started) vi.resetModules()

  beforeAll(async () => {
    state.startup ??= startNuxt(win, state).finally(() => {
      if (!state.started) delete state.startup
    })
    await state.startup
  })
}

async function startNuxt(win: AdapterWindow, state: AdapterState) {
  const { getNuxtAppCtx, tryUseNuxtApp } = await import("#app/nuxt")
  // An app left in the global Nuxt context by another environment must not be unmounted on rollback.
  const previousApp = tryUseNuxtApp()
  // The environment's initial payload, which the Nuxt client deletes after reading it.
  const hasPayload = "__NUXT__" in win
  const payload = win.__NUXT__
  let failed = false
  let setupError: unknown
  try {
    // Resolved by the adapter plugin to `dist/runtime/shared/nuxt.mjs` of the installed `@nuxt/test-utils`.
    // It is loaded through the module runner so Nuxt aliases resolve and the vue-wrapper-plugin state stays shared with `mountSuspended`.
    const { setupNuxt } = (await import(/* @vite-ignore */ SETUP_NUXT_ID)) as {
      setupNuxt?: unknown
    }
    if (typeof setupNuxt !== "function") {
      throw new TypeError(
        "nuxt-vitest-shared-app: @nuxt/test-utils no longer exports setupNuxt from dist/runtime/shared/nuxt.mjs; this @nuxt/test-utils version is not supported.",
      )
    }
    await setupNuxt()
  } catch (error) {
    failed = true
    setupError = error
  }

  const createdApp = tryUseNuxtApp()
  const app = createdApp && createdApp !== previousApp ? createdApp : undefined
  // A plugin error that Nuxt caught is also the root cause of a later setupNuxt failure, such as a missing router.
  const startupError = app && getStartupError(app)
  if (!failed && !startupError) {
    state.started = true
    return
  }
  const error = startupError ?? setupError

  let rollbackError: unknown
  try {
    // Nuxt entry catches plugin errors and still mounts, so a failing startup leaves either no app or a mounted one.
    app?.vueApp.unmount()
  } catch (unmountError) {
    rollbackError = unmountError
  } finally {
    // After unmount, because unmount callbacks may still use the app context.
    // Nuxt keeps the client app in the global context; a retry would otherwise fail with "Context conflict".
    if (app) {
      const context = getNuxtAppCtx(app._id)
      if (context.tryUse() === app) context.unset()
    }
    // The next attempt needs the payload with the runtime config.
    if (hasPayload) win.__NUXT__ = payload
  }
  if (rollbackError === undefined) throw error
  throw new AggregateError(
    [error, rollbackError],
    `nuxt-vitest-shared-app: Nuxt startup failed (${errorMessage(error)}), and unmounting the partially created app failed too (${errorMessage(rollbackError)}).`,
    { cause: error },
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
