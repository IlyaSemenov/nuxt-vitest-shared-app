import { expect, it } from "vitest"

import { gateReached } from "~/utils/navigation-gate"

import { pendingNavigation } from "./setup"

it("leaves a redirected navigation in flight", async () => {
  const router = useRouter()
  pendingNavigation.result = router.push("/redirecting")
  // The middleware of `/redirecting` has redirected to `/held`, whose middleware holds the navigation.
  await gateReached
  expect(router.currentRoute.value.fullPath).toBe("/")
})
