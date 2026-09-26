import type { NuxtApp } from "nuxt/app"

/**
 * Checks that `nuxtApp` is mounted in `document`, whichever entry started it.
 *
 * The global Nuxt context may still hold an app started in another environment of the same worker, so existence alone is not enough.
 *
 * @throws When the app is missing, unmounted, or mounted in another document.
 */
export function assertAppRunning(nuxtApp: NuxtApp | null | undefined, document: Document): NuxtApp {
  const vueApp = nuxtApp?.vueApp as { _container?: Element | null } | undefined
  // Vue keeps `_container` after unmount and only removes the container's `__vue_app__` link.
  const container = vueApp?._container
  const problem = !nuxtApp
    ? "no Nuxt app exists"
    : !container || (container as { __vue_app__?: unknown }).__vue_app__ !== vueApp
      ? "the Nuxt app is not mounted"
      : container.ownerDocument !== document || !container.isConnected
        ? "the Nuxt app is mounted in another document"
        : undefined
  if (problem) {
    throw new Error(
      `nuxt-vitest-shared-app: the Nuxt app is not running in the current test environment (${problem}). Make sure the config is created with defineSharedNuxtVitestConfig and the Nuxt startup succeeded.`,
    )
  }
  return nuxtApp!
}
