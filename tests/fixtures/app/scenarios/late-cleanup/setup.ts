import { getOrCreateWorkerState, registerNuxtTestReset } from "nuxt-vitest-shared-app"

export const cleanupControl = getOrCreateWorkerState("cleanup-control", () => ({
  slow: false,
  release: () => {},
}))

registerNuxtTestReset("slow", async () => {
  if (!cleanupControl.slow) return
  cleanupControl.slow = false
  await new Promise<void>((resolve) => {
    cleanupControl.release = resolve
  })
})
