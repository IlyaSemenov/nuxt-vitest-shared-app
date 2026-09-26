import { registerNuxtTestReset } from "nuxt-vitest-shared-app"
import { vi } from "vitest"

registerNuxtTestReset("failing-with-fake-timers", () => {
  if (vi.isFakeTimers()) throw new Error("probe: reset failed under fake timers")
})
