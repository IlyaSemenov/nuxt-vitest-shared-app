import { onNuxtTestCleanup } from "nuxt-vitest-shared-app"
import { it } from "vitest"

import { report } from "../../testing/report"

it("has a failing test cleanup", () => {
  onNuxtTestCleanup(() => report("test-cleanup", "older"))
  onNuxtTestCleanup(() => {
    throw new Error("probe: test cleanup failed")
  })
  onNuxtTestCleanup(() => report("test-cleanup", "newest"))
})

it("runs after the failing test cleanup", () => {})
