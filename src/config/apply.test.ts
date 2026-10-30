import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import {
  applySharedApp,
  locateRuntimeDirs,
  locateTestUtils,
  type ResolvedNuxtVitestConfig,
  type SharedNuxtVitestOptions,
} from "./apply"

const installation = locateTestUtils(import.meta.url)
const upstreamEntry = join(installation.runtimeDir, "entry.mjs")
const lifecycle = "/lib/lifecycle.mjs"

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
  { options = {} }: { options?: SharedNuxtVitestOptions } = {},
) {
  return applySharedApp(config, { options, installation, lifecycle, runtimeDirs: [] }).test!
}

describe("setup files", () => {
  it("adds the lifecycle right after the upstream entry", () => {
    expect(apply(resolvedConfig()).setupFiles).toEqual([
      upstreamEntry,
      lifecycle,
      "./project-setup.ts",
    ])
  })

  it("puts startup and lifecycle before project setup files listed earlier", () => {
    const config = resolvedConfig({ setupFiles: ["./first.ts", upstreamEntry, "./second.ts"] })
    expect(apply(config).setupFiles).toEqual([
      upstreamEntry,
      lifecycle,
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

  it("rejects parallel hooks", () => {
    expect(() => apply(resolvedConfig({ sequence: { hooks: "parallel" } }))).toThrow(
      'test.sequence.hooks must be "stack" or "list".',
    )
  })

  it("accepts the threads and forks pools only", () => {
    for (const pool of [undefined, "threads", "forks"]) {
      expect(() => apply(resolvedConfig({ pool }))).not.toThrow()
    }
    for (const pool of ["vmThreads", "vmForks"]) {
      expect(() => apply(resolvedConfig({ pool }))).toThrow(
        `test.pool must be "threads" or "forks", got "${pool}".`,
      )
    }
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

describe("server.fs.allow", () => {
  // An outer workspace keeps all packages in its store, outside of the nested workspace root of the project.
  const outer = realpathSync(mkdtempSync(join(tmpdir(), "nuxt-vitest-shared-app-")))
  afterAll(() => rmSync(outer, { recursive: true, force: true }))
  const store = join(outer, "node_modules/.store")
  const nested = join(outer, "nested")
  const write = (path: string, content: unknown = "") => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content))
  }
  const symlink = (path: string, target: string) => {
    mkdirSync(dirname(path), { recursive: true })
    symlinkSync(target, path)
  }

  write(join(outer, "package.json"), { workspaces: ["nested"] })
  write(join(nested, "package.json"), { workspaces: ["web"] })

  const libraryDir = join(store, "library/node_modules/nuxt-vitest-shared-app")
  write(join(libraryDir, "dist/config.mjs"))
  write(join(libraryDir, "dist/runtime/lifecycle.mjs"))
  const testUtilsDir = join(store, "test-utils/node_modules/@nuxt/test-utils")
  write(join(testUtilsDir, "package.json"), {
    name: "@nuxt/test-utils",
    version: installation.version,
    exports: { "./config": "./dist/config.mjs", "./package.json": "./package.json" },
  })
  write(join(testUtilsDir, "dist/config.mjs"))
  write(join(testUtilsDir, "dist/runtime/entry.mjs"))
  const nuxtDir = join(store, "nuxt/node_modules/nuxt")
  write(join(nuxtDir, "package.json"), { name: "nuxt" })
  symlink(join(store, "library/node_modules/@nuxt/test-utils"), testUtilsDir)
  symlink(join(store, "library/node_modules/nuxt"), nuxtDir)

  it("adds the runtime packages installed outside the workspace and keeps the existing entries", () => {
    const libraryUrl = pathToFileURL(join(libraryDir, "dist/config.mjs")).href
    const outerInstallation = locateTestUtils(libraryUrl)
    const config = resolvedConfig({
      setupFiles: [join(outerInstallation.runtimeDir, "entry.mjs")],
    })
    // Vite and Nuxt stop at the nested workspace root.
    config.server = { fs: { allow: [nested, "/project/extra"] } }
    const allow = applySharedApp(config, {
      options: {},
      installation: outerInstallation,
      lifecycle: join(libraryDir, "dist/runtime/lifecycle.mjs"),
      runtimeDirs: locateRuntimeDirs(libraryUrl),
    }).server!.fs!.allow!

    // The library allows its own build output and the whole packages it depends on, but no other packages of the store.
    expect(allow).toEqual([
      nested,
      "/project/extra",
      join(libraryDir, "dist"),
      testUtilsDir,
      nuxtDir,
    ])
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

it("rejects an installed @nuxt/test-utils without app reuse", () => {
  const unsupported = { ...installation, version: "4.3.2" }
  expect(() =>
    applySharedApp(resolvedConfig(), {
      options: {},
      installation: unsupported,
      lifecycle,
      runtimeDirs: [],
    }),
  ).toThrow("@nuxt/test-utils 4.3.2 is not supported.")
})
