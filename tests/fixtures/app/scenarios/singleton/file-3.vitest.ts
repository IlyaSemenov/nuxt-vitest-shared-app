import { mountSuspended } from "@nuxt/test-utils/runtime"
import { expect, it } from "vitest"

import ServiceProbe from "~/components/ServiceProbe.vue"
import { getService } from "~/services/service"

it("sees the service created by the plugin at startup", async () => {
  const service = useNuxtApp().$service
  expect(service.id).toBe(1)
  expect(getService()).toBe(service)
  const wrapper = await mountSuspended(ServiceProbe)
  expect(wrapper.text()).toBe("1:1")
})
