import { mountSuspended } from "@nuxt/test-utils/runtime"
import { overrideNuxtImport } from "nuxt-vitest-shared-app"
import { expect, it } from "vitest"

import GreetingProbe from "~/components/GreetingProbe.vue"

it("keeps overrides working in the next file", async () => {
  overrideNuxtImport("useGreeting", (name) => `Hey, ${name}`)
  const wrapper = await mountSuspended(GreetingProbe, { route: "/" })
  expect(wrapper.text()).toBe("Hey, nobody")
})

it("uses the original after the override is cleared", async () => {
  const wrapper = await mountSuspended(GreetingProbe, { route: "/" })
  expect(wrapper.text()).toBe("Hello, nobody")
})
