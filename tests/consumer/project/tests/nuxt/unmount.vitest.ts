import { mountSuspended } from "@nuxt/test-utils/runtime"
import { expect, it } from "vitest"

import ResourceHolder from "~/components/ResourceHolder.vue"
import { heldResources } from "~/utils/resources"

let held: { released: boolean } | undefined

it("mounts a component holding a resource", async () => {
  await mountSuspended(ResourceHolder)
  expect(heldResources.size).toBe(1)
  held = [...heldResources][0]
})

it("unmounted the wrapper after the previous test", () => {
  expect(held?.released).toBe(true)
  expect(heldResources.size).toBe(0)
})
