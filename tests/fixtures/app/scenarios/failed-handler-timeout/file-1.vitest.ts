import { expect, it, onTestFailed } from "vitest"

import { report } from "../../testing/report"

it("has a hanging failure handler", () => {
  onTestFailed(async () => {
    await new Promise<void>(() => {})
  }, 100)
  expect(1).toBe(2)
})

it("runs after the hanging failure handler", () => {
  report("failed-handler-timeout", "next test body ran")
})
