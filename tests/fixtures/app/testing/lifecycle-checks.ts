import { mountSuspended } from "@nuxt/test-utils/runtime"
import { expect, it } from "vitest"

import { report } from "./report"
import { probe as maybeProbe } from "./setup"

const probe = maybeProbe!

/** Checks shared by every file of the lifecycle scenario; each file must pass them on its own. */
export function defineLifecycleChecks(file: string) {
  it(`${file}: runs on the app started once in this environment`, async () => {
    const startups = window.__startupProbe?.startups
    report("file", { file, pool: process.env.VITEST_POOL_ID, startups })
    expect(startups).toBe(1)
    const wrapper = await mountSuspended({ template: "<p>ok</p>" })
    expect(wrapper.text()).toBe("ok")
  })

  it(`${file}: leaves state behind`, async () => {
    const resetsBefore = probe.resets
    await mountSuspended({ template: "<p>dirty</p>" }, { route: "/items/1" })
    useState("dirty", () => 1)
    localStorage.setItem("dirty", "1")
    sessionStorage.setItem("dirty", "1")
    document.cookie = "dirty=1; path=/"
    document.body.append(document.createElement("aside"))
    expect(useRouter().currentRoute.value.fullPath).toBe("/items/1")
    expect(probe.resets).toBe(resetsBefore)
  })

  it(`${file}: sees the state cleaned up`, () => {
    expect(document.querySelectorAll("[data-v-app]").length).toBe(1)
    expect(useRouter().currentRoute.value.fullPath).toBe("/")
    // Nuxt 4.4 keeps cleared keys with an undefined value, Nuxt 4.5 deletes them.
    expect(useState("dirty", () => "fresh").value).toBe("fresh")
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.cookie).toBe("")
    expect(document.body.querySelector("aside")).toBeNull()
  })

  it(`${file}: ran the project reset exactly once per test`, () => {
    // One reset after each earlier test in this environment, regardless of the number of files.
    expect(probe.resets).toBe(probe.tests - 1)
  })
}
