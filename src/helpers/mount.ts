import { mountSuspended } from "@nuxt/test-utils/runtime"
import type { mount, VueWrapper } from "@vue/test-utils"
import { type Component, type ComponentInternalInstance, defineComponent, h, type VNode } from "vue"

import { getEnvironmentStore } from "../store"

/** `mountSuspended` options that {@link mountNuxtComponent} rejects: inside a root they would apply to its host component instead of the mounted one. */
const UNSUPPORTED_OPTIONS = ["shallow", "spy", "scoped"] as const

/** Options of {@link mountNuxtComponent}: the `mountSuspended` options for `T`, except `shallow`, `spy`, and `scoped`. */
export type MountNuxtComponentOptions<T> = NonNullable<Parameters<typeof mountSuspended<T>>[1]> & {
  // An intersection preserves the named option types; `Omit` over the index signature of the `mountSuspended` options loses them.
  [K in (typeof UNSUPPORTED_OPTIONS)[number]]?: never
}

/** The wrapper of a component mounted with {@link mountNuxtComponent}. */
export type MountedNuxtComponent<T> = ReturnType<typeof mount<T>>

/** The value returned by a composable mounted with {@link mountNuxtComposable}, and the wrapper of its host component. */
export interface MountedNuxtComposable<T> {
  result: T
  wrapper: VueWrapper
}

/**
 * Mounts `component` with `mountSuspended` inside the root set with `setNuxtTestRoot`, attached to `document.body` unless `attachTo` is given.
 *
 * The returned wrapper is the wrapper of `component`, not of the root: `props()`, `emitted()`, `vm` and queries refer to it, while `setProps()` and `unmount()` act on the whole mount.
 * Without a root, it returns the `mountSuspended` wrapper.
 *
 * @throws For a functional component, which `mountSuspended` does not mount either.
 * @throws For the `shallow`, `spy`, and `scoped` options.
 * @throws When the root does not render `component` in its default slot.
 */
export async function mountNuxtComponent<T>(
  component: T,
  options?: MountNuxtComponentOptions<T>,
): Promise<MountedNuxtComponent<T>> {
  if (typeof component === "function") {
    throw new TypeError(
      "nuxt-vitest-shared-app: mountNuxtComponent does not support functional components.",
    )
  }
  const unsupported = UNSUPPORTED_OPTIONS.filter(
    (key) => (options as Record<string, unknown> | undefined)?.[key],
  )
  if (unsupported.length) {
    throw new TypeError(
      `nuxt-vitest-shared-app: mountNuxtComponent does not support the ${unsupported.join(", ")} option; use mountSuspended instead.`,
    )
  }

  // Teleported content and visibility checks need the tree in the live document, as in the app.
  const wrapper = await mountInRoot(component as Component, {
    attachTo: document.body,
    ...(options as MountNuxtComponentOptions<Component>),
  })
  return wrapper as unknown as MountedNuxtComponent<T>
}

/**
 * Calls `composable` in the setup of a component mounted with `mountSuspended`, so it gets the app's `inject()` and lifecycle hooks.
 *
 * `composable` is called synchronously and its return value is not awaited: hooks and watchers it registers after an `await` are not bound to the host component.
 * The host component is mounted inside the root set with `setNuxtTestRoot`, so the composable also gets what the root provides.
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
  const wrapper = await mountInRoot(host, { route: false })
  if ("error" in outcome) throw outcome.error
  return { result: outcome.result, wrapper }
}

/**
 * Mounts `component` with `mountSuspended` in the default slot of the environment root, or directly without a root.
 *
 * With a root, `mountSuspended` mounts a host that renders the root and passes its attrs, which hold the mount props, and slots to `component`.
 * The result proxies the wrapper of `component`, except for `setProps` and `unmount`, which only the mounted wrapper supports.
 */
async function mountInRoot(
  component: Component,
  options: MountNuxtComponentOptions<Component>,
): Promise<VueWrapper> {
  const root = getEnvironmentStore().root
  if (!root) return await mountSuspended(component, options)

  let instance: ComponentInternalInstance | null = null
  const host = defineComponent({
    inheritAttrs: false,
    // `mountSuspended` calls `setup` with the context of its outer wrapper, whose attrs `setProps` does not update, so the render reads the host's own attrs.
    render() {
      return h(root, null, () =>
        h(
          component,
          {
            ...this.$attrs,
            onVnodeMounted: (vnode: VNode) => {
              instance = vnode.component
            },
          },
          this.$slots,
        ),
      )
    },
  })
  const mounted = await mountSuspended(host, options)

  // Matching by the mounted instance, not just by type or name, skips other instances of the same component, e.g. recursive ones.
  const wrapper = mounted
    .findAllComponents(component)
    .find((found) => found.getCurrentComponent() === instance)
  if (!wrapper) {
    throw new Error(
      "nuxt-vitest-shared-app: the root set with setNuxtTestRoot did not render the mounted component in its default slot.",
    )
  }
  return new Proxy(wrapper, {
    get: (target, prop) => {
      const source = prop === "setProps" || prop === "unmount" ? mounted : target
      const value: unknown = Reflect.get(source, prop)
      return typeof value === "function" ? value.bind(source) : value
    },
  })
}
