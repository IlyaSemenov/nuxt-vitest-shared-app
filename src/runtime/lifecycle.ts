// Library lifecycle setup file, inserted by the config wrapper right after the Nuxt startup entry.
//
// It runs for every test file, because Vitest drops hooks between files even with `isolate: false`.
// The per-test cleanup is registered with `onTestFinished`, so it runs after all `afterEach` hooks of the project, even failed ones.

import { disableAutoUnmount, enableAutoUnmount } from "@vue/test-utils"
import { beforeAll, beforeEach } from "vitest"

import { getEnvironmentStore, isNuxtEnvironment } from "../store"
import { cleanupAfterTest } from "./cleanup"
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

  beforeEach(({ task, onTestFinished }) => {
    const store = getEnvironmentStore()
    if (store.contamination) {
      throw new Error(
        "nuxt-vitest-shared-app: this environment is contaminated by a failed cleanup after an earlier test and cannot run more tests.",
        { cause: store.contamination },
      )
    }
    if (task.concurrent) {
      throw new Error(
        "nuxt-vitest-shared-app: concurrent tests are not supported, because all tests of a worker share one Nuxt app. Remove test.concurrent / describe.concurrent.",
      )
    }
    // Runs after all afterEach hooks, even when one of them fails, which would skip a library afterEach.
    onTestFinished(async () => {
      // `beforeAll` failed, so there is no app to clean up and the failure is already reported.
      if (!store.baseline || store.contamination) return
      try {
        await cleanupAfterTest(store, store.baseline, unmountWrappers)
      } catch (error) {
        store.contamination = error as Error
        throw error
      }
    })
  })
}
