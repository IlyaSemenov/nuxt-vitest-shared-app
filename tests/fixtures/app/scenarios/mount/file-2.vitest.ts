import {
  mountNuxtComponent,
  mountNuxtComposable,
  onNuxtTestCleanup,
  setNuxtTestRoot,
} from "nuxt-vitest-shared-app"
import { beforeAll, expect, it } from "vitest"
import { defineComponent, h, inject, provide } from "vue"

import MountProbe from "~/components/MountProbe.vue"
import UnmountProbe from "~/components/UnmountProbe.vue"

// Renders another instance of the probe before the slot, so the returned wrapper must point to the mounted instance.
const ProbeRoot = defineComponent({
  setup(_, { slots }) {
    provide("probe-root-theme", "dark")
    return () =>
      h("section", { class: "probe-root" }, [h(MountProbe, { label: "root" }), slots.default?.()])
  },
})

beforeAll(() => {
  setNuxtTestRoot(ProbeRoot)
})

it("renders the component inside the root and returns its own wrapper", async () => {
  const wrapper = await mountNuxtComponent(MountProbe, {
    props: { label: "mounted" },
    slots: { default: "slot content" },
  })

  expect(wrapper.element.isConnected).toBe(true)
  expect(wrapper.element.closest(".probe-root")).not.toBeNull()
  expect(wrapper.text()).toBe("mounted / dark slot content")
  expect(wrapper.props()).toEqual({ label: "mounted" })

  await wrapper.trigger("click")
  expect(wrapper.emitted("ping")).toEqual([["mounted"]])
})

it("passes listeners from the props to the component", async () => {
  const pings: string[] = []
  const wrapper = await mountNuxtComponent(MountProbe, {
    props: { label: "mounted", onPing: (label: string) => pings.push(label) },
  })

  await wrapper.trigger("click")
  expect(pings).toEqual(["mounted"])
})

it("updates props with setProps", async () => {
  const wrapper = await mountNuxtComponent(MountProbe, { props: { label: "before" } })

  await wrapper.setProps({ label: "after" })

  expect(wrapper.text()).toBe("after / dark")
})

it("unmounts the root with the component", async () => {
  const wrapper = await mountNuxtComponent(MountProbe, { props: { label: "mounted" } })

  wrapper.unmount()

  expect(document.querySelector(".probe-root")).toBeNull()
})

it("unmounts the root with the component in the cleanup", async () => {
  let released = false
  window.addEventListener("unmount-probe:released", () => (released = true), { once: true })
  await mountNuxtComponent(UnmountProbe)

  onNuxtTestCleanup(() => {
    expect(released).toBe(true)
    expect(document.querySelector(".probe-root")).toBeNull()
  })
})

it("waits for a component with async setup", async () => {
  const AsyncProbe = defineComponent({
    async setup() {
      await new Promise((resolve) => setTimeout(resolve))
      return () => h("p", "resolved")
    },
  })

  const wrapper = await mountNuxtComponent(AsyncProbe)

  expect(wrapper.text()).toBe("resolved")
})

it("rejects with the error the component setup throws", async () => {
  const error = new Error("probe: setup failed")
  const FailingProbe = defineComponent({
    setup() {
      throw error
    },
  })

  await expect(mountNuxtComponent(FailingProbe)).rejects.toBe(error)
})

it("runs a composable inside the root", async () => {
  const { result } = await mountNuxtComposable(() => inject("probe-root-theme"))

  expect(result).toBe("dark")
})
