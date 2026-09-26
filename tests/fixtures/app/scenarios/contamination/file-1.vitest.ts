import { it } from "vitest"

import { resetControl } from "./setup"

it("breaks the cleanup", () => {
  resetControl.fail = true
})

it("runs after the failed cleanup", () => {})
