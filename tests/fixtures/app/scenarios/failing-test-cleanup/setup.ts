import { registerNuxtTestReset } from "nuxt-vitest-shared-app"

import { report } from "../../testing/report"

registerNuxtTestReset("after-test-cleanups", () => report("reset", "ran"))
