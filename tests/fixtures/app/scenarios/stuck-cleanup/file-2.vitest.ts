import { beforeAll, it } from "vitest"

import { report } from "../../testing/report"

beforeAll(() => {
  report("stuck-cleanup", "next file beforeAll ran")
})

it("runs in the environment of the hanging cleanup", () => {
  report("stuck-cleanup", "next file body ran")
})
