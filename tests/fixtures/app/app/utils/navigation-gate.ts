// Holds a navigation in route middleware, so a test can end while the navigation is still in flight.

let reach: () => void
let open: () => void

/** Resolves when a navigation reaches the gate. */
export const gateReached = new Promise<void>(resolve => (reach = resolve))

/** Lets the held navigation continue. */
export function openNavigationGate() {
  open()
}

/** Waits until the gate opens; the `hold` middleware calls it. */
export function passNavigationGate() {
  reach()
  return new Promise<void>(resolve => (open = resolve))
}
