import { getOrCreateWorkerState, registerNuxtTestReset } from "nuxt-vitest-shared-app"

export const resetControl = getOrCreateWorkerState("reset-control", () => ({ hang: false }))

registerNuxtTestReset("hanging", () => {
  if (resetControl.hang) return new Promise<void>(() => {})
})
