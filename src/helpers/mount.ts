import { mountSuspended } from "@nuxt/test-utils/runtime"
import type { VueWrapper } from "@vue/test-utils"
import { defineComponent, h } from "vue"

/** The value returned by a composable mounted with {@link mountNuxtComposable}, and the wrapper of its host component. */
export interface MountedNuxtComposable<T> {
  result: T
  wrapper: VueWrapper
}

/**
 * Calls `composable` in the setup of a component mounted with `mountSuspended`, so it gets the app's `inject()` and lifecycle hooks.
 *
 * `composable` is called synchronously and its return value is not awaited: hooks and watchers it registers after an `await` are not bound to the host component.
 * The host component is mounted without navigating, so the composable sees the current route.
 * It is rendered outside `<RouterView>`, so in-component route guards such as `onBeforeRouteLeave` are not registered.
 * The per-test cleanup unmounts it, which runs the composable's unmount hooks and stops its watchers.
 *
 * @throws The error thrown by `composable`.
 */
export async function mountNuxtComposable<T>(
  composable: () => T,
): Promise<MountedNuxtComposable<T>> {
  let outcome!: { result: T } | { error: unknown }
  const host = defineComponent({
    setup() {
      // `mountSuspended` resolves without rejecting when Nuxt handles a fatal error itself, so the error is caught here.
      try {
        outcome = { result: composable() }
      } catch (error) {
        outcome = { error }
      }
      return () => h("div")
    },
  })
  // By default `mountSuspended` navigates to `/` when the current route differs, which waits for `setTimeout` and hangs under fake timers.
  const wrapper = await mountSuspended(host, { route: false })
  if ("error" in outcome) throw outcome.error
  return { result: outcome.result, wrapper }
}
