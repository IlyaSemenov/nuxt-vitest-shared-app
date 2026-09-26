import { it, vi } from "vitest"

import { report } from "../../testing/report"
import { resetControl } from "./setup"

it("leaves a hanging cleanup", () => {
  resetControl.hang = true
  vi.useFakeTimers()
  vi.stubGlobal("probeStub", true)
})

it("runs after the hanging cleanup", () => {
  report("stuck-cleanup", "second test body ran")
})
