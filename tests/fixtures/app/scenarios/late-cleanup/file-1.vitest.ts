import { afterAll, describe, it } from "vitest"

import { report } from "../../testing/report"
import { cleanupControl } from "./setup"

// When the timed out cleanup finishes: `before-next-test` or `after-next-test`.
const release = process.env.LATE_RELEASE

async function finishCleanup() {
  cleanupControl.release()
  await new Promise((resolve) => setTimeout(resolve, 100))
}

describe("slow cleanup", () => {
  it("leaves a slow cleanup", () => {
    cleanupControl.slow = true
  })

  afterAll(async () => {
    if (release === "before-next-test") await finishCleanup()
  })
})

describe("next suite", () => {
  it("runs after the late cleanup", () => {
    report("late-cleanup", "next test body ran")
  })

  afterAll(async () => {
    if (release === "after-next-test") await finishCleanup()
  })
})
