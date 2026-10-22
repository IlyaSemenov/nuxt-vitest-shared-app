import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    config: "src/config.ts",
    // The setup file that the config wrapper references by path next to `config.mjs`.
    "runtime/lifecycle": "src/runtime/lifecycle.ts",
  },
  format: "esm",
  dts: true,
  publint: true,
  attw: {
    profile: "esm-only",
  },
})
