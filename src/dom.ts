import { vi } from "vitest"

/**
 * Stubs the global `IntersectionObserver` with one that reports every observed target as visible immediately in `observe()`.
 *
 * Targets are elements, plus the environment's own `window` and `document`, which are measured as `document.documentElement`.
 * Any other target throws a `TypeError`, as a browser does.
 *
 * happy-dom and the `@nuxt/test-utils` mock never call the observer callback, so components that wait for visibility never render their content.
 * The stub is installed with `vi.stubGlobal`, so the per-test cleanup removes it.
 */
export function stubVisibleIntersectionObserver(): void {
  vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver)
}

class VisibleIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly scrollMargin = "0px"
  readonly thresholds: readonly number[]
  readonly #callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.#callback = callback
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? "0px"
    const threshold = options.threshold ?? 0
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold]
  }

  observe(target: Element): void {
    const rect = measure(target)
    const entry: IntersectionObserverEntry = {
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      boundingClientRect: rect,
      intersectionRect: rect,
      rootBounds: null,
      // vueuse `useElementVisibility` keeps the entry with the latest `time`.
      time: performance.now(),
    }
    this.#callback([entry], this)
  }

  unobserve(): void {}

  disconnect(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return []
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
