import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import { overridableNuxtImport, registerNuxtTestReset } from "nuxt-vitest-shared-app"

import type { useRoute } from "#app/composables/router"
import type { useUser } from "~/composables/user"

declare module "nuxt-vitest-shared-app" {
  interface TestNuxtImports {
    useRoute: typeof useRoute
    useUser: typeof useUser
  }
}

mockNuxtImport("useRoute", overridableNuxtImport("useRoute"))
mockNuxtImport(
  "useUser",
  overridableNuxtImport("useUser", () => ref(null)),
)

export const resets = { count: 0 }

registerNuxtTestReset("counter", () => {
  resets.count++
})
