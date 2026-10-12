import { getEnvironmentStore } from "./store"

/**
 * Registers a cleanup callback for the current test.
 *
 * Callbacks run in the cleanup after the test, in reverse registration order, and are awaited.
 * They run after mounted wrappers are unmounted and before the router navigates back to the route baseline, while the import overrides of the test still apply.
 *
 * @throws Outside a running test, e.g. at the top level of a file or in `beforeAll`, and outside the Vitest `nuxt` environment.
 */
export function onNuxtTestCleanup(cleanup: () => unknown): void {
  const store = getEnvironmentStore()
  if (!store.testCleanups) {
    throw new Error(
      "nuxt-vitest-shared-app: onNuxtTestCleanup() must be called while a test runs: in the test, in beforeEach or afterEach, or in a helper called there.",
    )
  }
  store.testCleanups.push(cleanup)
}
