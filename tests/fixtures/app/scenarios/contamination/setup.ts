import { getOrCreateWorkerState, registerNuxtTestReset } from "nuxt-vitest-shared-app"

export const resetControl = getOrCreateWorkerState("reset-control", () => ({ fail: false }))

registerNuxtTestReset("failing", () => {
  if (resetControl.fail) throw new Error("probe: reset failed")
})
