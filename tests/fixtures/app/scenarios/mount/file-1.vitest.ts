import { mountNuxtComponent } from "nuxt-vitest-shared-app"
import { expect, it } from "vitest"
import { h } from "vue"

import MountProbe from "~/components/MountProbe.vue"

it("mounts the component attached to the document without a root", async () => {
  const wrapper = await mountNuxtComponent(MountProbe, {
    props: { label: "plain" },
    slots: { default: "slot content" },
  })

  expect(wrapper.element.isConnected).toBe(true)
  expect(wrapper.text()).toBe("plain / none slot content")

  await wrapper.trigger("click")
  expect(wrapper.emitted("ping")).toEqual([["plain"]])
})

it("mounts the component where attachTo points", async () => {
  const container = document.createElement("div")
  document.body.append(container)

  const wrapper = await mountNuxtComponent(MountProbe, {
    props: { label: "plain" },
    attachTo: container,
  })

  expect(container.contains(wrapper.element)).toBe(true)
})

it("rejects a functional component", async () => {
  await expect(mountNuxtComponent(() => h("p"))).rejects.toThrow(
    "does not support functional components",
  )
})

it("rejects options that would apply to the root host", async () => {
  await expect(
    // @ts-expect-error the option is not part of the contract
    mountNuxtComponent(MountProbe, { props: { label: "plain" }, shallow: true }),
  ).rejects.toThrow("does not support the shallow option")
})
