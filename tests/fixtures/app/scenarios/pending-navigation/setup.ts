import { getOrCreateWorkerState } from "nuxt-vitest-shared-app"

/** The navigation that the first file leaves in flight, for the second file to await. */
export const pendingNavigation = getOrCreateWorkerState("pending-navigation", () => ({
  result: Promise.resolve() as Promise<unknown>,
}))
