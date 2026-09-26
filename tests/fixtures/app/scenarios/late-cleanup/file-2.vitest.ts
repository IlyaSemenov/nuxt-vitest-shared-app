import { it } from "vitest"

import { report } from "../../testing/report"

it("runs after the late cleanup finished", () => {
  report("late-cleanup", "next file body ran")
})
