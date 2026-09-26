let instance: { id: number } | undefined
let created = 0

/** Creates the singleton service; called once by the service plugin. */
export function createService() {
  instance = { id: ++created }
  return instance
}

/** The singleton created by the service plugin, as seen through the module graph. */
export function getService() {
  return instance
}
