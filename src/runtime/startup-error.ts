import type { NuxtApp } from "nuxt/app"

/**
 * Returns the error that Nuxt caught while starting `nuxtApp`, wrapped with the Nuxt error as its cause.
 *
 * Nuxt catches plugin and mount errors during startup, stores them in `payload.error`, and continues with a partially initialized app.
 */
export function getStartupError(nuxtApp: NuxtApp): Error | undefined {
  const error = nuxtApp.payload.error
  if (!error) return undefined
  return new Error(`nuxt-vitest-shared-app: Nuxt startup failed: ${error.message}`, {
    cause: error,
  })
}
