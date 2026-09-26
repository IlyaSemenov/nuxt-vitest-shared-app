import { describe, expect, it } from "vitest"

import { expectPassed, nativeSuite, runFixture, type FixtureRun } from "./helpers/fixture"

function expectSingleStartupAcrossFiles(run: FixtureRun, files: string[]) {
  const reports = run.reports("file") as Array<{ file: string; startups: number }>
  expect(reports.map((report) => report.file).sort()).toEqual(files)
  expect(reports.every((report) => report.startups === 1)).toBe(true)
}

describe("adapter mode", () => {
  it("shares one app between files of a worker, with cleanup, hooks and resets in every file", async () => {
    const run = await runFixture("lifecycle")
    expectPassed(run)
    expectSingleStartupAcrossFiles(run, ["file-1", "file-2", "file-3"])
  })

  it("shares one app between files in the forks pool", async () => {
    const run = await runFixture("lifecycle", { POOL: "forks" })
    expectPassed(run)
    expectSingleStartupAcrossFiles(run, ["file-1", "file-2", "file-3"])
  })

  it("starts one app per worker", async () => {
    const run = await runFixture("workers", { MAX_WORKERS: "2" })
    expectPassed(run)
    const files = run.reports("file") as Array<{ pool: string; startups: number }>
    expect(files).toHaveLength(4)
    expect(new Set(files.map((file) => file.pool)).size).toBe(2)
    expect(files.every((file) => file.startups === 1)).toBe(true)
  })

  it("keeps the route baseline captured before project beforeAll hooks", async () => {
    expectPassed(await runFixture("baseline"))
  })

  it("fails files clearly when the app is not running", async () => {
    const run = await runFixture("readiness", { PROBE_STARTUP: "skip" })
    expect(run.suiteErrors.get("scenarios/readiness/file-1.vitest.ts")).toContain(
      "the Nuxt app is not running in the current test environment (no Nuxt app exists)",
    )
  })
})

// Simulated with the lifecycle of https://github.com/nuxt/test-utils/pull/1821 until a release reuses the app natively.
describe("native mode", () => {
  const native = { STARTUP_MODE: "native", SIMULATE_NATIVE_REUSE: "1" }

  it("shares one app between files of a worker, with cleanup, hooks and resets in every file", async () => {
    const run = await runFixture("lifecycle", native)
    expectPassed(run)
    expectSingleStartupAcrossFiles(run, ["file-1", "file-2", "file-3"])
  })

  it("fails files clearly when the app is not running", async () => {
    const run = await runFixture("readiness", { ...native, PROBE_STARTUP: "skip" })
    expect(run.suiteErrors.get("scenarios/readiness/file-1.vitest.ts")).toContain(
      "the Nuxt app is not running in the current test environment (no Nuxt app exists)",
    )
  })
})

it.skipIf(nativeSuite)("detects the per-file startup of the upstream 4.3 entry", async () => {
  // The second startup cannot mount on the container of the first app, which the readiness check reports.
  const run = await runFixture("lifecycle", { STARTUP_MODE: "native" })
  expect(run.reports("file")).toHaveLength(1)
  const errors = [...run.suiteErrors.values()]
  expect(errors).toHaveLength(2)
  for (const error of errors) {
    expect(error).toContain(
      "the Nuxt app is not running in the current test environment (the Nuxt app is not mounted)",
    )
  }
})
