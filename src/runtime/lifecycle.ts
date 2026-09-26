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
    // Vitest aborts the signal when the test, one of its hooks, or its `onTestFinished`/`onTestFailed` callbacks time out, or the run is cancelled.
    // It does not stop the pending work, which may change state during later tests, so the listener stays for the whole test lifecycle.
    const onAbort = () => {
      store.contamination ??= new Error(
        store.cleanupPending
          ? "nuxt-vitest-shared-app: the cleanup after an earlier test did not finish in time."
          : "nuxt-vitest-shared-app: an earlier test was aborted, e.g. by a timeout, and its work may still be running.",
        { cause: signal.reason },
      )
      // The remaining cleanup may never run, but project teardown hooks still do.
      restoreTestRunner()
    }
    if (signal.aborted) onAbort()
    else signal.addEventListener("abort", onAbort, { once: true })

    // Runs after all afterEach hooks, even when one of them fails, which would skip a library afterEach.
    onTestFinished(async () => {
      // `beforeAll` failed, so there is no app to clean up and the failure is already reported.
      // A contamination recorded during this test does not skip it: the environment was clean when the test started.
      if (!store.baseline) return
      store.cleanupPending = true
      try {
        await cleanupAfterTest(store, store.baseline, unmountWrappers)
      } catch (error) {
        // A late failure keeps the timeout error, which the following tests already reported.
        store.contamination ??= error as Error
        throw error
      } finally {
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
