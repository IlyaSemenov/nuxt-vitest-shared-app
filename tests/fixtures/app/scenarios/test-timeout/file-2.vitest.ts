import { it } from "vitest"

import { report } from "../../testing/report"

it("runs in the environment of the timed out test", () => {
  report("test-timeout", "next file body ran")
})
