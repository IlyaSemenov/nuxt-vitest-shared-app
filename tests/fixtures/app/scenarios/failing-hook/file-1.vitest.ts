import { mountSuspended } from "@nuxt/test-utils/runtime"
import { overrideNuxtImport } from "nuxt-vitest-shared-app"
import { afterEach, expect, it, vi } from "vitest"

import GreetingProbe from "~/components/GreetingProbe.vue"

let failHook = false

afterEach(() => {
  if (failHook) {
    failHook = false
    throw new Error("probe: project afterEach failed")
  }
})

it("dirties the environment, then its afterEach fails", () => {
  failHook = true
  overrideNuxtImport("useGreeting", () => "overridden")
  useState("dirty", () => "dirty")
  vi.useFakeTimers()
})

it("runs on a cleaned up environment", async () => {
  expect(vi.isFakeTimers()).toBe(false)
  expect(useState("dirty", () => "fresh").value).toBe("fresh")
  const wrapper = await mountSuspended(GreetingProbe, { route: "/" })
  expect(wrapper.text()).toBe("Hello, nobody")
})
