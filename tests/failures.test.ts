import { describe, expect, it } from "vitest"

import { runFixture } from "./helpers/fixture"

const firstFile = "scenarios/startup/file-1.vitest.ts"
const secondFile = "scenarios/startup/file-2.vitest.ts"
const retryTest = "runs on exactly one mounted app with one set of subscriptions"

describe("startup failure", () => {
  it("retries in the next file when startup fails before app creation", async () => {
    const run = await runFixture("startup", { PROBE_STARTUP: "fail-before" })
    expect(run.suiteErrors.get(firstFile)).toContain("probe: startup failed before app creation")
    expect(run.test(retryTest, secondFile)?.status, run.output).toBe("passed")
    expect(run.reports("startup")).toEqual([{ startups: 2, mountedApps: 1, pings: 1 }])
  })

  it("unmounts the partially created app and retries in the next file", async () => {
    const run = await runFixture("startup", { PROBE_STARTUP: "fail-after" })
    expect(run.suiteErrors.get(firstFile)).toContain("probe: startup failed after app creation")
    expect(run.test(retryTest, secondFile)?.status, run.output).toBe("passed")
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
    expect(run.test(retryTest, secondFile)?.status, run.output).toBe("passed")
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
    expect(run.suiteErrors.get(secondFile)).toBe(
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
    const failedCleanup = run.test("breaks the cleanup")
    expect(failedCleanup?.status).toBe("failed")
    expect(run.output).toContain(
      'CleanupError: nuxt-vitest-shared-app: cleanup failed.\n- project reset "failing": probe: reset failed',
    )
    const following = run.test("runs after the failed cleanup")
    expect(following?.status).toBe("failed")
    expect(following?.errors).toContain("this environment is contaminated")
    // A following file fails in the library `beforeAll`, before its own hooks.
    expect(run.suiteErrors.get("scenarios/contamination/file-2.vitest.ts")).toContain(
      "this environment is contaminated",
    )
    // The contamination error references the original failure as its cause.
    expect(run.output).toMatch(/contaminated[\s\S]*Caused by: CleanupError/)
  })

  it("fails every following test when the cleanup hangs", async () => {
    const run = await runFixture("stuck-cleanup", { HOOK_TIMEOUT: "500" })
    // The hook timeout message differs between Vitest versions.
    expect(run.test("leaves a hanging cleanup")?.status).toBe("failed")
    expect(run.test("runs after the hanging cleanup")?.errors).toContain(
      "this environment is contaminated",
    )
    expect(run.suiteErrors.get("scenarios/stuck-cleanup/file-2.vitest.ts")).toContain(
      "this environment is contaminated",
    )
    expect(run.output).toMatch(/contaminated[\s\S]*Caused by: Error: .*did not finish in time/)
    // Project hooks still run, so timers and globals are restored although the cleanup never finished.
    expect(run.reports("stuck-cleanup-runner")).toEqual([
      { fakeTimers: true, stubbed: true },
      { fakeTimers: false, stubbed: false },
    ])
    expect(run.reports("stuck-cleanup")).toEqual([])
  })

  it.each(["before-next-test", "after-next-test"])(
    "keeps the environment contaminated when a timed out cleanup finishes late (%s)",
    async (release) => {
      const run = await runFixture("late-cleanup", { HOOK_TIMEOUT: "500", LATE_RELEASE: release })
      expect(run.test("slow cleanup leaves a slow cleanup")?.status).toBe("failed")
      expect(run.test("next suite runs after the late cleanup")?.errors).toContain(
        "this environment is contaminated",
      )
      expect(run.suiteErrors.get("scenarios/late-cleanup/file-2.vitest.ts")).toContain(
        "this environment is contaminated",
      )
      expect(run.reports("late-cleanup")).toEqual([])
    },
  )

  it("fails every following test after a test timed out", async () => {
    const run = await runFixture("test-timeout")
    expect(run.test("times out while its body is still pending")?.status).toBe("failed")
    expect(run.test("runs after the timed out test")?.errors).toContain(
      "this environment is contaminated",
    )
    expect(run.suiteErrors.get("scenarios/test-timeout/file-2.vitest.ts")).toContain(
      "this environment is contaminated",
    )
    expect(run.output).toMatch(
      /contaminated[\s\S]*Caused by: Error: .*was aborted, e\.g\. by a timeout/,
    )
    expect(run.reports("test-timeout")).toEqual([])
  })

  it("fails every following test after an onTestFailed callback timed out", async () => {
    const run = await runFixture("failed-handler-timeout")
    expect(run.test("has a hanging failure handler")?.status).toBe("failed")
    expect(run.test("runs after the hanging failure handler")?.errors).toContain(
      "this environment is contaminated",
    )
    expect(run.suiteErrors.get("scenarios/failed-handler-timeout/file-2.vitest.ts")).toContain(
      "this environment is contaminated",
    )
    expect(run.reports("failed-handler-timeout")).toEqual([])
  })

  it("restores real timers when a reset fails under fake timers", async () => {
    const run = await runFixture("fake-timers")
    expect(run.test("leaves fake timers and a pending timer on")?.errors).toContain(
      "probe: reset failed under fake timers",
    )
    expect(run.reports("fake-timers")).toEqual([{ fakeTimers: false, fired: false }])
  })
})
