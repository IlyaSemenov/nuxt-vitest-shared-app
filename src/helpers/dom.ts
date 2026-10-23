import { vi } from "vitest"
import { nextTick } from "vue"

/**
 * Stubs the global `IntersectionObserver` with one that reports every observed target as visible immediately in `observe()`.
 *
 * Targets are elements, plus the environment's own `window` and `document`, which are measured as `document.documentElement`.
 * Any other target throws a `TypeError`, as a browser does.
 *
 * happy-dom and the `@nuxt/test-utils` mock never call the observer callback, so components that wait for visibility never render their content.
 * The stub is installed with `vi.stubGlobal`, so the per-test cleanup removes it.
 *
 * @returns A function that reports `target`, or every observed target when it is omitted, as visible or hidden to the observers that observe it, and resolves after the next Vue tick, so watchers of the visibility have run.
 */
export function stubVisibleIntersectionObserver(): (
  visible: boolean,
  target?: Element,
) => Promise<void> {
  const observers = new Set<StubIntersectionObserver>()
  vi.stubGlobal(
    "IntersectionObserver",
    class extends StubIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options)
        observers.add(this)
      }
    },
  )
  return async (visible, target) => {
    for (const observer of observers) {
      observer.report(visible, target)
    }
    // Without the tick, two calls in a row would be batched, and watchers would see only the last visibility.
    await nextTick()
  }
}

class StubIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly scrollMargin = "0px"
  readonly thresholds: readonly number[]
  readonly #callback: IntersectionObserverCallback
  readonly #targets = new Set<Element>()

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.#callback = callback
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? "0px"
    const threshold = options.threshold ?? 0
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold]
  }

  observe(target: Element): void {
    const entry = createEntry(target, true)
    this.#targets.add(target)
    this.#callback([entry], this)
  }

  unobserve(target: Element): void {
    this.#targets.delete(target)
  }

  disconnect(): void {
    this.#targets.clear()
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  /** Calls the observer callback for `target`, or for every observed target when it is omitted, if it is observed. */
  report(visible: boolean, target?: Element): void {
    const targets = target
      ? [...this.#targets].filter((observed) => observed === target)
      : [...this.#targets]
    if (targets.length) {
      this.#callback(
        targets.map((observed) => createEntry(observed, visible)),
        this,
      )
    }
  }
}

function createEntry(target: Element, visible: boolean): IntersectionObserverEntry {
  const rect = measure(target)
  return {
    target,
    isIntersecting: visible,
    intersectionRatio: visible ? 1 : 0,
    boundingClientRect: rect,
    intersectionRect: visible ? rect : new DOMRectReadOnly(),
    rootBounds: null,
    // vueuse `useElementVisibility` keeps the entry with the latest `time`.
    time: performance.now(),
  }
}

// VueUse maps `window` and `document` to `document.documentElement` by `instanceof`, which fails in the Vitest environment,
// where `window` is the global object; so they are recognized by identity and reported as passed.
function measure(target: Element): DOMRectReadOnly {
  const unknownTarget: unknown = target
  if (unknownTarget === window || unknownTarget === document) {
    return document.documentElement.getBoundingClientRect()
  }
  if (typeof target?.getBoundingClientRect !== "function") {
    throw new TypeError(
      "Failed to execute 'observe' on 'IntersectionObserver': parameter 1 is not of type 'Element'.",
    )
  }
  return target.getBoundingClientRect()
}
