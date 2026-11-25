import { mountNuxtComponent } from "nuxt-vitest-shared-app"
import { expect, it, vi } from "vitest"

import MountProbe from "~/components/MountProbe.vue"
import { openNavigationGate } from "~/utils/navigation-gate"

import { pendingNavigation } from "./setup"

// `mountSuspended` navigates to `/` unless the app is already there, and the navigation waits for timers that fake timers never fire.
it("mounts under fake timers after the navigation of the earlier test finishes", async () => {
  openNavigationGate()
  await pendingNavigation.result
  expect(useRouter().currentRoute.value.fullPath).toBe("/")
  expect(location.pathname + location.search).toBe("/")
  vi.useFakeTimers()

  const wrapper = await mountNuxtComponent(MountProbe, { props: { label: "mounted" } })

  expect(wrapper.text()).toBe("mounted / none")
}, 2000)
