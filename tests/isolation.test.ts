import { expect, it } from "vitest"

import { expectPassed, runFixture } from "./helpers/fixture"

it("isolates tests with every cleanup step", async () => {
  expectPassed(await runFixture("cleanup"))
})

it("cleans up after a failing project afterEach hook", async () => {
  const run = await runFixture("failing-hook")
  const failed = run.tests.get("dirties the environment, then its afterEach fails")
  expect(failed?.status).toBe("failed")
  expect(failed?.errors).toContain("probe: project afterEach failed")
  expect(run.tests.get("runs on a cleaned up environment")?.status, run.output).toBe("passed")
})

it("overrides auto-imports through the mockNuxtImport macro", async () => {
  expectPassed(await runFixture("overrides"))
})

it("keeps the plugin singleton identity across files", async () => {
  expectPassed(await runFixture("singleton"))
})

it("stubs a visible IntersectionObserver for one test", async () => {
  expectPassed(await runFixture("dom"))
})

it("binds state to the environment window and supports files with other environments", async () => {
  expectPassed(await runFixture("environments"))
})

it("rejects concurrent tests", async () => {
  const run = await runFixture("concurrent")
  for (const name of ["concurrent suite first", "concurrent suite second", "concurrent test"]) {
    expect(run.tests.get(name)?.errors).toContain("concurrent tests are not supported")
  }
  expect(run.tests.get("sequential test")?.status).toBe("passed")
})
