import { mountSuspended } from "@nuxt/test-utils/runtime"
import {
  getOrCreateWorkerState,
  onNuxtTestCleanup,
  overrideNuxtImport,
} from "nuxt-vitest-shared-app"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import UnmountProbe from "~/components/UnmountProbe.vue"

function captureError(run: () => void) {
  try {
    run()
  } catch (error) {
    return (error as Error).message
  }
}

const outsideTestError = "onNuxtTestCleanup() must be called while a test runs"
const topLevelError = captureError(() => onNuxtTestCleanup(() => {}))

describe("order and position in the cleanup", () => {
  const log = getOrCreateWorkerState("test-cleanup-log", () => [] as string[])

  it("registers cleanups", async () => {
    let mounted = true
    window.addEventListener("unmount-probe:released", () => (mounted = false), { once: true })
    await mountSuspended(UnmountProbe)
    await useRouter().push("/items/7")
    overrideNuxtImport("useGreeting", () => "overridden")

    onNuxtTestCleanup(() => {
      const route = useRouter().currentRoute.value.fullPath
      log.push(`older: mounted=${mounted} route=${route} greeting=${useGreeting("probe")}`)
    })
    onNuxtTestCleanup(async () => {
      // The older callback must not start before this one settles.
      await new Promise((resolve) => setTimeout(resolve, 10))
      log.push("newest")
    })
  })

  it("ran them newest first, after unmount and before the route reset, under the test overrides", () => {
    expect(log).toEqual(["newest", "older: mounted=false route=/items/7 greeting=overridden"])
    expect(useRouter().currentRoute.value.fullPath).toBe("/")
  })
})

describe("registration in beforeEach", () => {
  const runs = getOrCreateWorkerState("test-cleanup-runs", () => ({ count: 0 }))

  function countCleanupRuns() {
    onNuxtTestCleanup(() => runs.count++)
  }

  beforeEach(() => {
    countCleanupRuns()
  })

  it("does not run the cleanup during the test", () => {
    expect(runs.count).toBe(0)
  })

  it("ran the cleanup of the previous test once", () => {
    expect(runs.count).toBe(1)
  })

  it("does not carry callbacks over to the next test", () => {
    // The two earlier tests each ran their own callback once; the callback of this test has not run yet.
    expect(runs.count).toBe(2)
  })
})

describe("outside a test", () => {
  let beforeAllError: string | undefined

  beforeAll(() => {
    beforeAllError = captureError(() => onNuxtTestCleanup(() => {}))
  })

  it("throws at the top level of a file", () => {
    expect(topLevelError).toContain(outsideTestError)
  })

  it("throws in beforeAll", () => {
    expect(beforeAllError).toContain(outsideTestError)
  })
})
