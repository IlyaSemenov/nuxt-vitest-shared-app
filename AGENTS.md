# nuxt-vitest-shared-app Agent Guide

## Overview

Nuxt component tests in Vitest on one Nuxt app per Vitest worker, with deterministic per-test cleanup and typed overrides of Nuxt auto-imports, built on `@nuxt/test-utils`.

Read [README.md](README.md) completely before changing the public API, package behavior, supported runtimes, or user documentation.

Read the relevant guide in [development/](development/README.md) before starting:

- [user-documentation.md](development/user-documentation.md) before changing user documentation.

Extend this guide only with stable, non-obvious conventions, architecture, contracts, workflows, and gotchas that most changes need; put those of one topic in a guide in development/, and list the guide in its index and above with the task that needs it.
Do not catalog files or restate information evident from their names and locations.

## Scope

- Keep production code in `src/`.
- Name a directory of one concept in the singular, such as `parser/`, and a directory of like items in the plural, such as `rules/`.
- Keep focused module tests beside their source as `*.test.ts`.
- Test each behavior at the lowest level that can check it: a helper directly, a module that combines helpers by its own unit tests.
- Keep integration, package-boundary, and type-inference tests in `tests/`, importing the package by name: they see only the public API.
- Import internals that a test cannot reach through the public API through the `#src/*` subpath import, never by relative paths into `src/`.
- Name compile-only tests `*.type-test.ts`.
- Keep `src/index.ts` limited to explicit public exports.
- Export from `src/index.ts` every type that the inferred types of public values reference, so that the declarations of a consumer module can name them.
- Treat `package.json` exports and supported runtimes as public contracts.

## Architecture

- Keep each concern in its place:
  - `src/config/`: the config wrapper and the `@nuxt/test-utils` version check;
  - `src/runtime/`: the library lifecycle setup file, cleanup, and their helpers;
  - `src/helpers/`: optional test helpers that build on the shared app but are not part of its lifecycle;
  - root modules: the public API with its environment-bound store.
- Leave Nuxt startup and app reuse to the `@nuxt/test-utils` runtime entry; the library lifecycle runs right after it and must not import `@nuxt/test-utils` internals.
- `src/config/**` runs in Node while Vitest loads the config; everything else runs inside the Nuxt environment through the Vitest module runner.
- Bind persistent state to the Nuxt environment `window` (`src/store.ts`), never to module scope.
  Use `Symbol.for` keys for markers that must survive module re-evaluation.
- Register lifecycle hooks in every file.
- Keep `overridableNuxtImport` and its module free of Nuxt imports; mock factories run during hoisted mock evaluation.
- Import Nuxt modules in runtime files lazily inside hooks, never at module top level.
- Use the app's router instance (`getRealRouter`), never auto-imported router composables.

## Design

- With every change, look for refactorings that reduce the complexity of the code it touches, such as duplicated logic or a concept spread over several modules.
  Make those that ease the change, and propose the others in the final report, listed apart from its fixes.
- Give a domain rule or contract a function of its own at its first use, such as how a cache key is built or which values an option accepts, so that the next use finds it; give it a module of its own only when several modules use it.
  Do not extract code that only looks alike.
- Before adding a helper, search for an existing one that does the same.

## Refactoring

- When moving or splitting code, move its tests to follow it.

## Version policy

- Keep the minimum `@nuxt/test-utils` version in `src/config/versions.ts` equal to the lowest version in the `peerDependencies`.
- Update the supported versions in `README.md`, the `peerDependencies`, and the compatibility matrix in `.github/workflows/test.yml` together.

## Documentation

- Write public README and JSDoc text for package users who do not know the implementation.
- When a change makes an existing statement false, fix that statement rather than add an explanation next to it.
- Add JSDoc to every exported declaration and to internal helpers whose contract, inputs, output, or failure behavior is not obvious.
- Add inline comments beside every non-obvious invariant, algorithmic choice, safety constraint, and intentionally limited behavior.
- Update nearby JSDoc and inline comments whenever the documented code changes, and remove comments that no longer apply.
- Do not narrate self-evident syntax or restate what a name already communicates.
- Do not document obvious or implied defaults.
- Describe a default only when readers need it to make a decision or avoid surprising behavior.
- Use One Sentence Per Line for connected prose, including JSDoc and code comments: do not wrap a sentence across lines.
- Keep semantically connected explanations as prose paragraphs, and use lists for separate assertions.
- Link a file of another repository by a tag or a commit, such as of the version you checked, never by a branch such as `main`, whose file changes.

## Changesets

- Add changesets as [.changeset/README.md](.changeset/README.md) describes.

## Tests

- Add a `describe` block where the file gives a reason for it: several APIs or behaviors in one file, or a fixture that belongs to some cases but not all.
  Name such a block after what it covers and keep its fixtures inside it.
- Distinguish several same-kind values by role rather than by order.
  When values differ only by order, number them with digits instead of ordinal words.
- Keep tests deterministic so a failure repeats on every run.
  Generate random inputs from an explicit seed and print the seed in failure messages so the failing input can be replayed.

- Test runtime behavior through fixture scenarios in `tests/fixtures/app/scenarios/<name>/`, run in a separate Vitest process by `runFixture` from `tests/*.test.ts`.
  A scenario may add `setup.ts`; environment variables documented in `tests/fixtures/app/testing/probe-plugin.ts` and `tests/fixtures/app/vitest.config.ts` select failure injection and pool settings.
- Fixture files run in name order within a scenario; number files by the order a scenario relies on.
- Look up fixture test results with `run.test(name, file?)`; pass the file when several files share a test name.
- Report values from fixture tests with `report()` and read them with `run.reports()`.
- Check `AggregateError` and error-cause details in `run.output`; the JSON report keeps only the first error.
- Keep assertions valid for every supported Nuxt version, e.g. Nuxt 4.4 keeps keys cleared by `clearNuxtState` with an `undefined` value while Nuxt 4.5 deletes them.

## Checks

- Run the `types` script when public types or TypeScript configuration change.
- Run the `test` script when behavior changes.
- Run the `test:consumer` script when package exports, declarations, build output, or supported runtimes change; it installs the packed package into `tests/consumer/project`.
- Run the `build` script when package exports, declarations, or supported runtimes change.
