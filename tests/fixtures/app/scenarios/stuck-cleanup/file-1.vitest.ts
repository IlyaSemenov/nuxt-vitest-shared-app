import { afterEach, it, vi } from "vitest"

import { report } from "../../testing/report"
import { resetControl } from "./setup"

afterEach(() => {
  if (resetControl.hang) {
    report("stuck-cleanup-runner", {
      fakeTimers: vi.isFakeTimers(),
      stubbed: "probeStub" in globalThis,
    })
  }
})

it("leaves a hanging cleanup", () => {
  resetControl.hang = true
  vi.useFakeTimers()
  vi.stubGlobal("probeStub", true)
})

it("runs after the hanging cleanup", () => {
  report("stuck-cleanup", "second test body ran")
})
