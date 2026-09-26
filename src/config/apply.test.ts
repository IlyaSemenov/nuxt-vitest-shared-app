import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  applySharedApp,
  locateTestUtils,
  type ResolvedNuxtVitestConfig,
  type SharedNuxtVitestOptions,
} from "./apply"

const installation = locateTestUtils(import.meta.url)
const upstreamEntry = join(installation.runtimeDir, "entry.mjs")
const files = { adapterEntry: "/lib/adapter-entry.mjs", lifecycle: "/lib/lifecycle.mjs" }

function resolvedConfig(test: Record<string, unknown> = {}): ResolvedNuxtVitestConfig {
  return {
    plugins: [],
    test: {
      environment: "nuxt",
      isolate: false,
      setupFiles: [upstreamEntry, "./project-setup.ts"],
      ...test,
    },
  } as ResolvedNuxtVitestConfig
}

function apply(
  config: ResolvedNuxtVitestConfig,
  {
    mode = "adapter",
    options = {},
  }: { mode?: "adapter" | "native"; options?: SharedNuxtVitestOptions } = {},
) {
  return applySharedApp(config, { options, installation, files, mode }).test!
}

describe("setup files", () => {
  it("replaces the upstream entry with the adapter entry in adapter mode", () => {
    expect(apply(resolvedConfig()).setupFiles).toEqual([
      files.adapterEntry,
      files.lifecycle,
      "./project-setup.ts",
    ])
  })

  it("keeps the upstream entry in native mode", () => {
    expect(apply(resolvedConfig(), { mode: "native" }).setupFiles).toEqual([
      upstreamEntry,
      files.lifecycle,
      "./project-setup.ts",
    ])
  })

  it("puts startup and lifecycle before project setup files listed earlier", () => {
    const config = resolvedConfig({ setupFiles: ["./first.ts", upstreamEntry, "./second.ts"] })
    expect(apply(config).setupFiles).toEqual([
      files.adapterEntry,
      files.lifecycle,
      "./first.ts",
      "./second.ts",
    ])
  })

  it("rejects a missing entry", () => {
    expect(() => apply(resolvedConfig({ setupFiles: ["./project-setup.ts"] }))).toThrow(
      `expected exactly one @nuxt/test-utils ${installation.version} runtime entry (${upstreamEntry}) in test.setupFiles, found 0. Setup files: ./project-setup.ts.`,
    )
  })

  it("rejects an entry of another installation even with the same file name", () => {
    const config = resolvedConfig({
      setupFiles: ["/elsewhere/node_modules/@nuxt/test-utils/dist/runtime/entry.mjs"],
    })
    expect(() => apply(config)).toThrow(/found 0/)
  })

  it("rejects several entries", () => {
    const config = resolvedConfig({ setupFiles: [upstreamEntry, upstreamEntry] })
    expect(() => apply(config)).toThrow(/found 2\. Setup files: .*entry\.mjs, .*entry\.mjs\./)
  })
})

describe("test settings", () => {
  it("requires isolate: false", () => {
    expect(() => apply(resolvedConfig({ isolate: true }))).toThrow(
      "set test.isolate to false so test files share the Nuxt app.",
    )
    expect(() => apply(resolvedConfig({ isolate: undefined }))).toThrow(/test\.isolate/)
  })

  it("requires the nuxt environment", () => {
    expect(() => apply(resolvedConfig({ environment: "happy-dom" }))).toThrow(
      'set test.environment to "nuxt"',
    )
  })

  it("sets list setup files", () => {
    expect(apply(resolvedConfig()).sequence).toEqual({ setupFiles: "list" })
    expect(apply(resolvedConfig({ sequence: { hooks: "list" } })).sequence).toEqual({
      setupFiles: "list",
      hooks: "list",
    })
  })

  it("rejects parallel setup files", () => {
    expect(() => apply(resolvedConfig({ sequence: { setupFiles: "parallel" } }))).toThrow(
      'test.sequence.setupFiles must be "list".',
    )
  })

  it("rejects concurrent sequences", () => {
    expect(() => apply(resolvedConfig({ sequence: { concurrent: true } }))).toThrow(
      "test.sequence.concurrent is not supported.",
    )
  })

  it("inlines the library and keeps inline dependencies of the user", () => {
    const test = apply(resolvedConfig({ server: { deps: { inline: ["some-dep"] } } }))
    const inline = test.server!.deps!.inline as Array<string | RegExp>
    expect(inline[0]).toBe("some-dep")
    expect(
      inline.some(
        (pattern) =>
          pattern instanceof RegExp &&
          pattern.test("/app/node_modules/nuxt-vitest-shared-app/dist/runtime/lifecycle.mjs"),
      ),
    ).toBe(true)
  })

  it("preserves unrelated settings", () => {
    const test = apply(
      resolvedConfig({ include: ["**/*.vitest.ts"], pool: "threads", testTimeout: 1234 }),
    )
    expect(test).toMatchObject({ include: ["**/*.vitest.ts"], pool: "threads", testTimeout: 1234 })
  })
})

describe("silenceSuspenseInfo", () => {
  const suspenseInfo =
    "[Vue warn]: <Suspense> is an experimental feature and its API will likely change."

  it("filters the Suspense message and chains the user handler", () => {
    const seen: string[] = []
    const test = apply(
      resolvedConfig({
        onConsoleLog: (log: string) => {
          seen.push(log)
          return log !== "hidden by user"
        },
      }),
      { options: { silenceSuspenseInfo: true } },
    )
    expect(test.onConsoleLog!(suspenseInfo, "stderr", undefined)).toBe(false)
    expect(test.onConsoleLog!("hidden by user", "stdout", undefined)).toBe(false)
    expect(test.onConsoleLog!("shown", "stdout", undefined)).toBe(true)
    expect(seen).toEqual(["hidden by user", "shown"])
  })

  it("leaves console output alone by default", () => {
    expect(apply(resolvedConfig()).onConsoleLog).toBeUndefined()
  })
})

describe("version policy", () => {
  it("applies the policy of the installed version by default", () => {
    const unsupported = { ...installation, version: "9.0.0" }
    expect(() =>
      applySharedApp(resolvedConfig(), { options: {}, installation: unsupported, files }),
    ).toThrow("@nuxt/test-utils 9.0.0 is not supported.")
  })
})
