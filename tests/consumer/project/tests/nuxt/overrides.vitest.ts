import { mountSuspended } from "@nuxt/test-utils/runtime"
import { overrideNuxtImport, overrideNuxtRoute } from "nuxt-vitest-shared-app"
import { stubVisibleIntersectionObserver } from "nuxt-vitest-shared-app/dom"
import { expect, expectTypeOf, it } from "vitest"

import UserName from "~/components/UserName.vue"

import { resets } from "./setup"

it("applies the project default override", async () => {
  const wrapper = await mountSuspended(UserName)
  expect(wrapper.text()).toBe("anonymous at /")
})

it("overrides imports and the route for one test", async () => {
  overrideNuxtImport("useUser", () => ref({ name: "Ann" }))
  overrideNuxtRoute({ path: "/profile" })
  const wrapper = await mountSuspended(UserName)
  expect(wrapper.text()).toBe("Ann at /profile")
})

it("types overrides with the augmented registry", () => {
  // @ts-expect-error useUser returns a ref
  overrideNuxtImport("useUser", () => ({ name: "not a ref" }))
  // @ts-expect-error unregistered import
  expect(() => overrideNuxtImport("useCookie", () => ref(""))).toThrow("is not overridable")
  // @ts-expect-error route fields keep their types
  overrideNuxtRoute({ path: 1 })
  // Runtime calls above replaced the project default; the next test starts fresh.
})

it("runs project resets and exposes the DOM helper", () => {
  expect(resets.count).toBeGreaterThan(0)
  expectTypeOf(stubVisibleIntersectionObserver).toEqualTypeOf<() => void>()
  stubVisibleIntersectionObserver()
})
