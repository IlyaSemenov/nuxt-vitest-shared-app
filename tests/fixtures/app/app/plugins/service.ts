import { createService } from "~/services/service"

export default defineNuxtPlugin(() => {
  return { provide: { service: createService() } }
})
