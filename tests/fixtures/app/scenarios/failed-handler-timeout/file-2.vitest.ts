import { it } from "vitest"

import { report } from "../../testing/report"

it("runs in the environment of the hanging failure handler", () => {
  report("failed-handler-timeout", "next file body ran")
})
