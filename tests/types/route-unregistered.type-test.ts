// Compiled in a separate program: a project that does not register useRoute.
import { overrideNuxtRoute } from "nuxt-vitest-shared-app"

// @ts-expect-error overrideNuxtRoute requires useRoute in TestNuxtImports
overrideNuxtRoute({ path: "/" })
