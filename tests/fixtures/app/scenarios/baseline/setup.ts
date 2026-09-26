import { beforeAll } from "vitest"

// Runs after the library captured the route baseline, so the baseline stays "/".
beforeAll(async () => {
  await useRouter().push("/items/7")
})
