import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    config: "src/config.ts",
    dom: "src/dom.ts",
    // Setup files that the config wrapper references by path next to `config.mjs`.
    "adapter/entry": "src/adapter/entry.ts",
    "runtime/lifecycle": "src/runtime/lifecycle.ts",
  },
  format: "esm",
  dts: true,
  // Resolved by the Nuxt aliases of the Vitest module runner in the consumer project.
  deps: { neverBundle: [/^#app(\/|$)/] },
  publint: true,
  attw: {
    profile: "esm-only",
  },
})
