import { registerNuxtTestReset } from "nuxt-vitest-shared-app"
import { vi } from "vitest"

import { report } from "../../testing/report"

registerNuxtTestReset("fake-timers", () => {
  report("fake-timers-reset", { fakeTimers: vi.isFakeTimers() })
})
