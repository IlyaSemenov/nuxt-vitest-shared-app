import { describe, expect, it } from "vitest"

import { runFixture } from "./helpers/fixture"

const firstFile = "scenarios/startup/file-1.vitest.ts"
const retryTest = "runs on exactly one mounted app with one set of subscriptions"

describe("startup failure", () => {
  it("retries in the next file when startup fails before app creation", async () => {
    const run = await runFixture("startup", { PROBE_STARTUP: "fail-before" })
    expect(run.suiteErrors.get(firstFile)).toContain("probe: startup failed before app creation")
    expect(run.tests.get(retryTest)?.status, run.output).toBe("passed")
    expect(run.reports("startup")).toEqual([{ startups: 2, mountedApps: 1, pings: 1 }])
  })

  it("unmounts the partially created app and retries in the next file", async () => {
    const run = await runFixture("startup", { PROBE_STARTUP: "fail-after" })
    expect(run.suiteErrors.get(firstFile)).toContain("probe: startup failed after app creation")
    expect(run.tests.get(retryTest)?.status, run.output).toBe("passed")
    expect(run.reports("startup")).toEqual([{ startups: 2, mountedApps: 1, pings: 1 }])
  })

  it.each([
    ["fail-plugin", "probe: plugin failed"],
    // Without the router, setupNuxt itself fails; the plugin error is still reported as the cause.
    ["fail-plugin-pre", "probe: pre plugin failed"],
  ])("fails the startup on a plugin error that Nuxt caught (%s)", async (mode, message) => {
    const run = await runFixture("startup", { PROBE_STARTUP: mode })
    expect(run.suiteErrors.get(firstFile)).toBe(
      `nuxt-vitest-shared-app: Nuxt startup failed: ${message}`,
    )
    expect(run.output).toContain(`Caused by: Error: ${message}`)
    expect(run.tests.get(retryTest)?.status, run.output).toBe("passed")
    expect(run.reports("startup")).toEqual([{ startups: 2, mountedApps: 1, pings: 1 }])
  })

  it("fails every file on a plugin error with an upstream entry that does not retry", async () => {
    const run = await runFixture("startup", {
      STARTUP_MODE: "native",
      SIMULATE_NATIVE_REUSE: "1",
      PROBE_STARTUP: "fail-plugin",
    })
    expect(run.suiteErrors.get(firstFile)).toBe(
      "nuxt-vitest-shared-app: Nuxt startup failed: probe: plugin failed",
    )
    expect(run.suiteErrors.get("scenarios/startup/file-2.vitest.ts")).toBe(
      "nuxt-vitest-shared-app: Nuxt startup failed earlier in this environment.",
    )
  })

  it("keeps the original error together with a rollback error", async () => {
    const run = await runFixture("startup", { PROBE_STARTUP: "fail-rollback" })
    // Vitest reports an AggregateError as its errors, the original one first.
    expect(run.suiteErrors.get(firstFile)).toBe("probe: startup failed after app creation")
    expect(run.output).toMatch(
      /FAIL {2}scenarios\/startup\/file-1\.vitest\.ts .*\nError: probe: startup failed after app creation[\s\S]*FAIL {2}scenarios\/startup\/file-1\.vitest\.ts .*\nError: probe: unmount failed/,
    )
  })
})

describe("cleanup failure", () => {
  it("fails the test and every following test in the environment", async () => {
    const run = await runFixture("contamination")
    const failedCleanup = run.tests.get("breaks the cleanup")
    expect(failedCleanup?.status).toBe("failed")
    expect(run.output).toContain(
      'CleanupError: nuxt-vitest-shared-app: cleanup failed.\n- project reset "failing": probe: reset failed',
    )
    for (const name of ["runs after the failed cleanup", "runs in the contaminated environment"]) {
      const test = run.tests.get(name)
      expect(test?.status).toBe("failed")
      expect(test?.errors).toContain("this environment is contaminated by a failed cleanup")
    }
    // The contamination error references the original failure as its cause.
    expect(run.output).toMatch(/contaminated by a failed cleanup[\s\S]*Caused by: CleanupError/)
  })

  it("restores real timers when a reset fails under fake timers", async () => {
    const run = await runFixture("fake-timers")
    expect(run.tests.get("leaves fake timers and a pending timer on")?.errors).toContain(
      "probe: reset failed under fake timers",
    )
    expect(run.reports("fake-timers")).toEqual([{ fakeTimers: false, fired: false }])
  })
})
