import type { Component } from "vue"

import { getEnvironmentStore, isNuxtEnvironment } from "./store"

/**
 * Sets the component that the library mount helpers render around the mounted component, in place of the providers that `app.vue` renders around pages.
 *
 * The root must render its default slot, which holds the mounted component.
 * Setting it again replaces it, so a setup file that runs for every test file can call it; it stays for the whole environment.
 *
 * Outside the Vitest `nuxt` environment, e.g. in a file with `@vitest-environment node`, nothing is set.
 */
export function setNuxtTestRoot(root: Component): void {
  if (!isNuxtEnvironment()) return
  getEnvironmentStore().root = root
}
