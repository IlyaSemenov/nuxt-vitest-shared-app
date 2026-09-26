import type { NuxtApp } from "nuxt/app"
import type { Router } from "vue-router"

/**
 * Returns the router instance of the app.
 *
 * Unlike the auto-imported `useRouter`/`useRoute`/`navigateTo`, it cannot be replaced by a project's `mockNuxtImport`.
 */
export function getRealRouter(nuxtApp: NuxtApp): Router {
  return nuxtApp.$router as Router
}
