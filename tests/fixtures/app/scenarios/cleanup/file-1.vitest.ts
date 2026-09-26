import { mountSuspended } from "@nuxt/test-utils/runtime"
import { getOrCreateWorkerState } from "nuxt-vitest-shared-app"
import { describe, expect, it, vi } from "vitest"

import LateWriter from "~/components/LateWriter.vue"
import UnmountProbe from "~/components/UnmountProbe.vue"

const released = getOrCreateWorkerState("released", () => ({ count: 0 }))

// Each pair dirties one kind of state, then checks that the next test does not see it.
describe("unmount wrappers", () => {
  it("dirties", async () => {
    window.addEventListener("unmount-probe:released", () => released.count++, { once: true })
    await mountSuspended(UnmountProbe)
    expect(released.count).toBe(0)
  })
  it("is clean", () => {
    expect(released.count).toBe(1)
  })
})

describe("flush promises before clearing state", () => {
  it("dirties", async () => {
    await mountSuspended(LateWriter)
  })
  it("is clean", () => {
    expect(useState("late").value).toBeUndefined()
  })
})

describe("clearError", () => {
  it("dirties", () => {
    showError({ statusCode: 418, statusMessage: "probe" })
    expect(useError().value).toBeTruthy()
  })
  it("is clean", () => {
    expect(useError().value).toBeFalsy()
  })
})

describe("clearNuxtData", () => {
  it("dirties", async () => {
    await mountSuspended({
      async setup() {
        await useAsyncData("probe-data", async () => "cached")
        return () => null
      },
    })
    expect(useNuxtData("probe-data").data.value).toBe("cached")
  })
  it("is clean", () => {
    expect(useNuxtData("probe-data").data.value).toBeUndefined()
  })
})

describe("clearNuxtState", () => {
  it("dirties", () => {
    useState("probe-state", () => "dirty")
  })
  it("is clean", () => {
    expect(useState("probe-state", () => "fresh").value).toBe("fresh")
  })
})

describe("timers", () => {
  let fired = false
  it("dirties", () => {
    vi.useFakeTimers()
    setTimeout(() => {
      fired = true
    }, 10)
  })
  it("is clean", () => {
    expect(vi.isFakeTimers()).toBe(false)
    vi.useFakeTimers()
    vi.runAllTimers()
    vi.useRealTimers()
    expect(fired).toBe(false)
  })
})

describe("envs and globals", () => {
  it("dirties", () => {
    vi.stubEnv("PROBE_ENV", "dirty")
    vi.stubGlobal("probeGlobal", "dirty")
  })
  it("is clean", () => {
    expect(process.env.PROBE_ENV).toBeUndefined()
    expect(globalThis).not.toHaveProperty("probeGlobal")
  })
})

describe("body children", () => {
  it("dirties", () => {
    const existing = document.body.firstElementChild!
    existing.setAttribute("data-probe", "kept")
    document.body.append(document.createElement("aside"))
  })
  it("removes only new direct children and keeps changes to existing ones", () => {
    expect(document.body.querySelector("aside")).toBeNull()
    const existing = document.body.firstElementChild!
    expect(existing.getAttribute("data-probe")).toBe("kept")
    existing.removeAttribute("data-probe")
  })
})
