import { mountNuxtComposable, onNuxtTestCleanup } from "nuxt-vitest-shared-app"
import { expect, it, vi } from "vitest"
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { useRoute as useVueRoute } from "vue-router"

it("runs the composable with app injections on the current route under fake timers", async () => {
  await useRouter().push("/items/1")
  vi.useFakeTimers()

  const { result, wrapper } = await mountNuxtComposable(() => {
    const mounted = ref(false)
    onMounted(() => (mounted.value = true))
    // vue-router's `useRoute` reads the route through `inject()`.
    return { path: useVueRoute().path, mounted }
  })

  expect(result.path).toBe("/items/1")
  expect(result.mounted.value).toBe(true)
  expect(wrapper.exists()).toBe(true)
  expect(useRouter().currentRoute.value.fullPath).toBe("/items/1")
})

it("unmounts the composable in the cleanup", async () => {
  const source = ref(0)
  const seen: number[] = []
  let unmounted = false
  await mountNuxtComposable(() => {
    watch(source, (value) => seen.push(value), { flush: "sync" })
    onUnmounted(() => (unmounted = true))
  })
  source.value = 1

  onNuxtTestCleanup(async () => {
    source.value = 2
    await nextTick()
    expect({ unmounted, seen }).toEqual({ unmounted: true, seen: [1] })
  })
})

it("rejects with the error the composable throws", async () => {
  const error = new Error("probe: composable failed")
  await expect(
    mountNuxtComposable(() => {
      throw error
    }),
  ).rejects.toBe(error)
})

it("rejects with a fatal Nuxt error the composable throws", async () => {
  const error = createError({ statusCode: 500, message: "probe: fatal", fatal: true })
  await expect(
    mountNuxtComposable(() => {
      throw error
    }),
  ).rejects.toBe(error)
})
