import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { createSharedNuxtVitestConfig } from "#src/config/define"
import type { StartupMode } from "#src/config/versions"

import { nativeReuseEntryPlugin, startupProbePlugin } from "./testing/probe-plugin"

const src = (path: string) => fileURLToPath(new URL(`../../../src/${path}`, import.meta.url))
const scenario = process.env.SCENARIO ?? "lifecycle"
const scenarioSetup = `./scenarios/${scenario}/setup.ts`

export default createSharedNuxtVitestConfig(
  {
    plugins: [
      startupProbePlugin(),
      ...(process.env.SIMULATE_NATIVE_REUSE ? [nativeReuseEntryPlugin()] : []),
    ],
    define: { __PROBE_STARTUP__: JSON.stringify(process.env.PROBE_STARTUP ?? "") },
    resolve: {
      alias: {
        "nuxt-vitest-shared-app/dom": src("dom.ts"),
        "nuxt-vitest-shared-app": src("index.ts"),
      },
    },
    test: {
      include: [`scenarios/${scenario}/*.vitest.ts`],
      environment: "nuxt",
      pool: "threads",
      isolate: false,
      maxWorkers: Number(process.env.MAX_WORKERS ?? 1),
      setupFiles: [
        "./testing/setup.ts",
        ...(existsSync(new URL(scenarioSetup, import.meta.url)) ? [scenarioSetup] : []),
      ],
    },
  },
  { silenceSuspenseInfo: true },
  new URL("../../../src/config.ts", import.meta.url).href,
  process.env.STARTUP_MODE as StartupMode | undefined,
)
