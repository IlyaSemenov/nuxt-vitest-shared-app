import { flushPromises } from "@vue/test-utils"
import { vi } from "vitest"
import { nextTick } from "vue"

import type { EnvironmentBaseline, EnvironmentStore } from "../store"
import { getRealRouter } from "./router"

/** A failed cleanup step and its error. */
export interface CleanupFailure {
  step: string
  error: unknown
}

/** Thrown after cleanup when one or more steps failed; `errors` holds every original error. */
export class CleanupError extends AggregateError {
  readonly failures: readonly CleanupFailure[]

  constructor(failures: CleanupFailure[]) {
    super(
      failures.map((failure) => failure.error),
      `nuxt-vitest-shared-app: cleanup failed.\n${failures
        .map((failure) => `- ${failure.step}: ${errorMessage(failure.error)}`)
        .join("\n")}`,
    )
    this.name = "CleanupError"
    this.failures = failures
  }
}

/**
 * Restores documented Nuxt and test-owned state after a test.
 *
 * Every step runs even if an earlier independent step failed.
 *
 * @throws {CleanupError} With all step failures after all steps have run.
 */
export async function cleanupAfterTest(
  store: EnvironmentStore,
  baseline: EnvironmentBaseline,
  unmountWrappers: (() => void) | undefined,
) {
  const failures: CleanupFailure[] = []
  async function step(name: string, run: () => unknown) {
    try {
      await run()
    } catch (error) {
      failures.push({ step: name, error })
    }
  }

  await step("unmount wrappers", () => unmountWrappers?.())
  // Settles handlers of already-resolved promises only; background work needs a project reset.
  await step("flush promises", async () => {
    await nextTick()
    await flushPromises()
  })
  await step("restore route", async () => {
    // The real router, not the overridable `useRoute`/`navigateTo`, which may still be overridden at this point.
    const { useNuxtApp } = await importNuxt()
    const router = getRealRouter(useNuxtApp())
    if (router.currentRoute.value.fullPath !== baseline.route) {
      await router.replace(baseline.route)
      const route = router.currentRoute.value.fullPath
      if (route !== baseline.route) {
        throw new Error(`route is ${route} after navigating back to ${baseline.route}`)
      }
    }
  })
  await step("clear overrides", () => store.overrides.clear())
  await step("clearError", async () => {
    const { clearError } = await importNuxt()
    await clearError()
  })
  await step("clearNuxtData", async () => {
    const { clearNuxtData } = await importNuxt()
    clearNuxtData()
  })
  await step("clearNuxtState", async () => {
    const { clearNuxtState } = await importNuxt()
    clearNuxtState(undefined, { reset: false })
  })
  for (const [key, { reset }] of store.resets) {
    await step(`project reset "${key}"`, reset)
  }
  await step("clear localStorage", () => localStorage.clear())
  await step("clear sessionStorage", () => sessionStorage.clear())
  await step("expire cookies", expireCookies)
  for (const [name, run] of RUNNER_STEPS) await step(name, run)
  await step("remove body children", () => {
    // A copy, because the live collection shrinks while children are removed.
    for (const child of Array.from(document.body.children)) {
      if (!baseline.bodyChildren.has(child)) child.remove()
    }
  })

  if (failures.length) throw new CleanupError(failures)
}

// Imported inside each step that needs it, so a failed import fails only those steps.
function importNuxt() {
  return import("nuxt/app")
}

// Test runner facilities that project hooks rely on, restored even after a cleanup timed out.
const RUNNER_STEPS: ReadonlyArray<[string, () => unknown]> = [
  ["clear timers", () => vi.clearAllTimers()],
  ["use real timers", () => vi.useRealTimers()],
  ["unstub envs", () => vi.unstubAllEnvs()],
  ["unstub globals", () => vi.unstubAllGlobals()],
]

/** Restores timers, envs and globals as far as possible, ignoring failures, for an environment that is already contaminated. */
export function restoreTestRunner() {
  for (const [, run] of RUNNER_STEPS) {
    try {
      run()
    } catch {
      // The environment already fails with the timeout error.
    }
  }
}

/** Expires every cookie visible in `document.cookie` for path `/` of the current origin. */
function expireCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]!.trim()
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
