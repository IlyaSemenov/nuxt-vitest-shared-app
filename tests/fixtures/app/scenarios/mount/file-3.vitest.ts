import { mountNuxtComponent, setNuxtTestRoot } from "nuxt-vitest-shared-app"
import { beforeAll, expect, it } from "vitest"
import { defineComponent, h } from "vue"

import MountProbe from "~/components/MountProbe.vue"

beforeAll(() => {
  setNuxtTestRoot(defineComponent(() => () => h("section")))
})

it("rejects when the root does not render its default slot", async () => {
  await expect(mountNuxtComponent(MountProbe, { props: { label: "mounted" } })).rejects.toThrow(
    "did not render the mounted component in its default slot",
  )
})
