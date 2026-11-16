import { mountNuxtComponent } from "nuxt-vitest-shared-app"
import { expectTypeOf } from "vitest"
import { defineComponent } from "vue"

const Probe = defineComponent({
  props: { label: { type: String, required: true } },
  emits: { ping: (label: string) => typeof label === "string" },
})

// Props are typed by the component.
const wrapper = await mountNuxtComponent(Probe, { props: { label: "a" } })
expectTypeOf(wrapper.props().label).toEqualTypeOf<string>()
expectTypeOf(wrapper.vm.label).toEqualTypeOf<string>()

// @ts-expect-error props must match the component
await mountNuxtComponent(Probe, { props: { label: 1 } })

// `mountSuspended` options pass through.
await mountNuxtComponent(Probe, { props: { label: "a" }, route: false, attachTo: document.body })

// @ts-expect-error options that would apply to the root host are rejected
await mountNuxtComponent(Probe, { props: { label: "a" }, shallow: true })
