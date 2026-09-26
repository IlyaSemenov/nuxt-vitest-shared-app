import { expect, it } from "vitest"

import { assertAppRunning } from "#src/runtime/readiness"

it("runs on the app of this environment", () => {
  expect(window.__startupProbe?.startups).toBe(1)
  expect(() => assertAppRunning(useNuxtApp(), document)).not.toThrow()
})
