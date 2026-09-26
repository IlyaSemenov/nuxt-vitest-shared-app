import { mountSuspended } from "@nuxt/test-utils/runtime"
import {
  overridableNuxtImport,
  overrideNuxtImport,
  overrideNuxtRoute,
  type TestNuxtImportName,
} from "nuxt-vitest-shared-app"
import { expect, it, vi } from "vitest"

import GreetingProbe from "~/components/GreetingProbe.vue"

it("overrides auto-imports used by the started app", async () => {
  overrideNuxtImport("useGreeting", (name) => `Hi, ${name}`)
  overrideNuxtRoute({ params: { name: "Ann" } })
  const wrapper = await mountSuspended(GreetingProbe)
  expect(wrapper.text()).toBe("Hi, Ann")
})

it("applies the fallback while the app starts and in tests", () => {
  expect(useNuxtApp().$startupLabel).toBe("fallback")
  expect(useStartupLabel()).toBe("fallback")
  overrideNuxtImport("useStartupLabel", () => "overridden")
  expect(useStartupLabel()).toBe("overridden")
})

it("returns to the fallback after an override", () => {
  expect(useStartupLabel()).toBe("fallback")
})

it("clears overrides after each test", async () => {
  const wrapper = await mountSuspended(GreetingProbe, { route: "/" })
  expect(wrapper.text()).toBe("Hello, nobody")
})

it("overrides navigateTo with a mock", async () => {
  const navigate = vi.fn()
  overrideNuxtImport("navigateTo", navigate)
  await mountSuspended({
    setup() {
      navigateTo("/items/1")
      return () => null
    },
  })
  expect(navigate).toHaveBeenCalledWith("/items/1")
  expect(useRouter().currentRoute.value.fullPath).toBe("/")
})

it("preserves this and arguments", () => {
  const receiver = { useGreeting }
  overrideNuxtImport("useGreeting", function (this: unknown, name) {
    return `${this === receiver}:${name}`
  })
  expect(receiver.useGreeting("x")).toBe("true:x")
})

it("returns the retained wrapper when the factory runs again", () => {
  const factory = overridableNuxtImport("useGreeting")
  const again = factory(useGreeting)
  expect(again).toBe(useGreeting)
  overrideNuxtImport("useGreeting", () => "overridden")
  expect(useGreeting("x")).toBe("overridden")
  expect(again("x")).toBe("overridden")
})

it("rejects names without an installed wrapper", () => {
  expect(() => overrideNuxtImport("useCookie" as TestNuxtImportName, () => "x")).toThrow(
    /"useCookie" is not overridable/,
  )
})
