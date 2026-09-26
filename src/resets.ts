import { getEnvironmentStore, isNuxtEnvironment, type ResetRegistration } from "./store"

/**
 * Registers a project reset that runs after each test, in registration order, and is awaited.
 *
 * Registering the same `key` again replaces the callback and keeps its position, so a setup file that runs for every test file does not accumulate registrations.
 *
 * Outside the Vitest `nuxt` environment, e.g. in a file with `@vitest-environment node`, nothing is registered.
 *
 * @returns A function that removes this registration, unless it has already been replaced.
 */
export function registerNuxtTestReset(key: string, reset: () => unknown): () => void {
  if (!isNuxtEnvironment()) return () => {}
  const store = getEnvironmentStore()
  const registration: ResetRegistration = { reset }
  store.resets.set(key, registration)
  return () => {
    if (store.resets.get(key) === registration) store.resets.delete(key)
  }
}
