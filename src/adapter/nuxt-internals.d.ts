// `#app/nuxt` resolves through the Nuxt aliases of the Vitest module runner; only the members used here are declared.
declare module "#app/nuxt" {
  import type { NuxtApp } from "nuxt/app"

  export function tryUseNuxtApp(): NuxtApp | null
  export function getNuxtAppCtx(id?: string): {
    tryUse(): NuxtApp | null
    unset(): void
  }
}
