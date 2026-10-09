import { expect, it } from "vitest"

import { expectPassed, runFixture } from "./helpers/fixture"

it("isolates tests with every cleanup step", async () => {
  expectPassed(await runFixture("cleanup"))
})

it("runs project resets under real timers and drops pending fake timers", async () => {
  const run = await runFixture("fake-timers")
  expectPassed(run)
  expect(run.reports("fake-timers-reset")).toEqual([{ fakeTimers: false }])
  expect(run.reports("fake-timers")).toEqual([{ fakeTimers: false, fired: false }])
})

it("cleans up after a failing project afterEach hook", async () => {
  const run = await runFixture("failing-hook")
  const failed = run.test("dirties the environment, then its afterEach fails")
  expect(failed?.status).toBe("failed")
  expect(failed?.errors).toContain("probe: project afterEach failed")
  expect(run.test("runs on a cleaned up environment")?.status, run.output).toBe("passed")
})

it("overrides auto-imports through the mockNuxtImport macro", async () => {
  expectPassed(await runFixture("overrides"))
})

it("keeps the plugin singleton identity across files", async () => {
  expectPassed(await runFixture("singleton"))
})

it("stubs a visible IntersectionObserver for one test", async () => {
  expectPassed(await runFixture("intersection-observer"))
})

it("binds state to the environment window and supports files with other environments", async () => {
  expectPassed(await runFixture("environments"))
})

it("rejects concurrent tests", async () => {
  const run = await runFixture("concurrent")
  for (const name of ["concurrent suite first", "concurrent suite second", "concurrent test"]) {
    expect(run.test(name)?.errors).toContain("concurrent tests are not supported")
  }
  expect(run.test("sequential test")?.status).toBe("passed")
})
