import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import {
  getOrCreateWorkerState,
  overridableNuxtImport,
  registerNuxtTestReset,
} from "nuxt-vitest-shared-app"
import { beforeEach } from "vitest"

import type { navigateTo, useRoute } from "#app/composables/router"
import type { useGreeting } from "~/composables/greeting"
import type { useStartupLabel } from "~/composables/startup-label"

declare module "nuxt-vitest-shared-app" {
  interface TestNuxtImports {
    navigateTo: typeof navigateTo
    useRoute: typeof useRoute
    useGreeting: typeof useGreeting
    useStartupLabel: typeof useStartupLabel
  }
}

mockNuxtImport("navigateTo", overridableNuxtImport("navigateTo"))
mockNuxtImport("useRoute", overridableNuxtImport("useRoute"))
mockNuxtImport("useGreeting", overridableNuxtImport("useGreeting"))
mockNuxtImport(
  "useStartupLabel",
  overridableNuxtImport("useStartupLabel", () => "fallback"),
)

/** Counters shared by all files of an environment; absent in files with another environment. */
export const probe =
  typeof window === "undefined"
    ? undefined
    : getOrCreateWorkerState("probe", () => ({ setupRuns: 0, tests: 0, resets: 0 }))

if (probe) {
  probe.setupRuns++
  beforeEach(() => {
    probe.tests++
  })
  registerNuxtTestReset("probe", () => {
    probe.resets++
  })
}
