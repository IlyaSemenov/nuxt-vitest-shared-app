import { defineSharedNuxtVitestConfig } from "nuxt-vitest-shared-app/config"

export default defineSharedNuxtVitestConfig(
  {
    test: {
      include: ["tests/nuxt/**/*.vitest.ts"],
      environment: "nuxt",
      pool: "threads",
      isolate: false,
      maxWorkers: 1,
      setupFiles: ["./tests/nuxt/setup.ts"],
    },
  },
  { silenceSuspenseInfo: true },
)
