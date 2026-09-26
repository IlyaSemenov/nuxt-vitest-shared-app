import { afterAll, it, vi } from "vitest"

import { report } from "../../testing/report"

let fired = false

it("leaves fake timers and a pending timer on", () => {
  vi.useFakeTimers()
  setTimeout(() => {
    fired = true
  }, 1000)
})

afterAll(() => {
  report("fake-timers", { fakeTimers: vi.isFakeTimers(), fired })
})
