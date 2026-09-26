import { it } from "vitest"

import { report } from "../../testing/report"

it("times out while its body is still pending", async () => {
  await new Promise<void>(() => {})
}, 100)

it("runs after the timed out test", () => {
  report("test-timeout", "next test body ran")
})
