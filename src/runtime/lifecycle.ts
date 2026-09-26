// Library lifecycle setup file, inserted by the config wrapper right after the Nuxt startup entry.
//
// It runs for every test file, because Vitest drops hooks between files even with `isolate: false`.
// The per-test cleanup is registered with `onTestFinished`, so it runs after all `afterEach` hooks of the project, even failed ones.

import { disableAutoUnmount, enableAutoUnmount } from "@vue/test-utils"
import { beforeAll, beforeEach } from "vitest"

import { getEnvironmentStore, isNuxtEnvironment, type EnvironmentStore } from "../store"
import { cleanupAfterTest, restoreTestRunner } from "./cleanup"
import { assertAppRunning } from "./readiness"
import { getRealRouter } from "./router"
import { getStartupError } from "./startup-error"

// Files with another environment, e.g. `@vitest-environment node`, have no Nuxt app to manage.
if (isNuxtEnvironment()) installLifecycle()

function installLifecycle() {
  let unmountWrappers: (() => void) | undefined
  // `enableAutoUnmount` throws when called twice, and every file needs its own callback.
  disableAutoUnmount()
  enableAutoUnmount((unmount) => {
    unmountWrappers = unmount
  })

  beforeAll(async () => {
    const store = getEnvironmentStore()
    // Before any project `beforeAll` of the file runs against a contaminated environment.
    assertNotContaminated(store)
    const { tryUseNuxtApp } = await import("nuxt/app")
    const nuxtApp = assertAppRunning(tryUseNuxtApp(), document)
    if (store.startupFailure) {
      throw new Error("nuxt-vitest-shared-app: Nuxt startup failed earlier in this environment.", {
        cause: store.startupFailure,
      })
    }
    if (!store.baseline) {
      // The adapter already retries such failures; this catches them from an upstream entry.
      const startupError = getStartupError(nuxtApp)
      if (startupError) {
        store.startupFailure = startupError
        throw startupError
      }
    }
    store.baseline ??= {
      route: getRealRouter(nuxtApp).currentRoute.value.fullPath,
      bodyChildren: new Set(document.body.children),
    }
  })

  beforeEach(({ task, signal, onTestFinished }) => {
    const store = getEnvironmentStore()
    assertNotContaminated(store)
    if (task.concurrent) {
      throw new Error(
        "nuxt-vitest-shared-app: concurrent tests are not supported, because all tests of a worker share one Nuxt app. Remove test.concurrent / describe.concurrent.",
      )
    }
    // Runs after all afterEach hooks, even when one of them fails, which would skip a library afterEach.
    onTestFinished(async () => {
      // `beforeAll` failed, so there is no app to clean up and the failure is already reported.
      if (!store.baseline || store.contamination) return
      // Vitest aborts the signal when the test or one of its hooks times out, or the run is cancelled, without stopping the pending work.
      // The cleanup still runs as far as it can, but the work may change state during later tests.
      if (signal.aborted) {
        store.contamination = new Error(
          "nuxt-vitest-shared-app: an earlier test was aborted before its cleanup, e.g. by a timeout, and its work may still be running.",
          { cause: signal.reason },
        )
        restoreTestRunner()
      }
      // The same signal is aborted when this hook times out; the cleanup may then still change state later too.
      const onTimeout = () => {
        store.contamination ??= new Error(
          "nuxt-vitest-shared-app: the cleanup after an earlier test did not finish in time.",
          { cause: signal.reason },
        )
        // The rest of the cleanup may never run, but project teardown hooks still do.
        restoreTestRunner()
      }
      if (!signal.aborted) signal.addEventListener("abort", onTimeout, { once: true })
      store.cleanupPending = true
      try {
        await cleanupAfterTest(store, store.baseline, unmountWrappers)
      } catch (error) {
        // A late failure keeps the timeout error, which the following tests already reported.
        store.contamination ??= error as Error
        throw error
      } finally {
        signal.removeEventListener("abort", onTimeout)
        store.cleanupPending = false
      }
    })
  })
}

/** @throws When a failed or unfinished cleanup left the environment in an unknown state. */
function assertNotContaminated(store: EnvironmentStore) {
  if (store.cleanupPending) {
    store.contamination ??= new Error(
      "nuxt-vitest-shared-app: the cleanup after an earlier test did not finish in time.",
    )
  }
  if (store.contamination) {
    throw new Error(
      "nuxt-vitest-shared-app: this environment is contaminated by an earlier test and cannot run more tests.",
      { cause: store.contamination },
    )
  }
}
