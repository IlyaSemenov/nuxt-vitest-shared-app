import { it } from "vitest"

import { report } from "../../testing/report"

it("runs in the environment of the hanging cleanup", () => {
  report("stuck-cleanup", "next file body ran")
})
