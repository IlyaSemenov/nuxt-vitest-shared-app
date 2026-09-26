import { getEnvironmentStore } from "./store"

/**
 * Returns state bound to the current Nuxt environment, creating it with `create` on first use.
 *
 * Use it for project helpers whose state must survive module re-evaluation between test files, such as a test API client shared with the started app.
 */
export function getOrCreateWorkerState<T>(name: string, create: () => T): T {
  const { workerState } = getEnvironmentStore()
  if (!workerState.has(name)) workerState.set(name, create())
  return workerState.get(name) as T
}
