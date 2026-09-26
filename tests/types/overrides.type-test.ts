import {
  overridableNuxtImport,
  overrideNuxtImport,
  overrideNuxtRoute,
  type TestNuxtImportName,
} from "nuxt-vitest-shared-app"
import { expectTypeOf } from "vitest"
import type { RouteLocationNormalizedLoaded } from "vue-router"

declare function useRoute(): RouteLocationNormalizedLoaded
declare function useGreeting(name: string): string

declare module "nuxt-vitest-shared-app" {
  interface TestNuxtImports {
    useRoute: typeof useRoute
    useGreeting: typeof useGreeting
  }
}

expectTypeOf<TestNuxtImportName>().toEqualTypeOf<"useRoute" | "useGreeting">()

// The factory receives and returns the registered type.
expectTypeOf(overridableNuxtImport("useGreeting")).toEqualTypeOf<
  (original: typeof useGreeting) => typeof useGreeting
>()
// @ts-expect-error unregistered names are rejected
overridableNuxtImport("useCookie")

// The fallback is typed by the registry.
overridableNuxtImport("useGreeting", (name) => {
  expectTypeOf(name).toEqualTypeOf<string>()
  return name
})
// @ts-expect-error the fallback must match the registered type
overridableNuxtImport("useGreeting", () => 1)

// Implementations are typed by the registry, including contextual parameter types.
overrideNuxtImport("useGreeting", (name) => {
  expectTypeOf(name).toEqualTypeOf<string>()
  return name.toUpperCase()
})
// @ts-expect-error the return type must match
overrideNuxtImport("useGreeting", () => 1)
// @ts-expect-error parameters must match
overrideNuxtImport("useGreeting", (name: number) => String(name))
// @ts-expect-error unregistered names are rejected
overrideNuxtImport("useCookie", () => "")

// A partial route of the registered useRoute type.
overrideNuxtRoute({ params: { id: "1" } })
overrideNuxtRoute({ path: "/items/1", query: { page: "2" } })
overrideNuxtRoute({})
// @ts-expect-error unknown route fields are rejected
overrideNuxtRoute({ unknown: true })
// @ts-expect-error route field types must match
overrideNuxtRoute({ path: 1 })
