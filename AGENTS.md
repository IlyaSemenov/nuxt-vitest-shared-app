# nuxt-vitest-shared-app Agent Guide

## Overview

Nuxt component tests in Vitest on one Nuxt app per Vitest worker, with deterministic per-test cleanup and typed overrides of Nuxt auto-imports, built on `@nuxt/test-utils`.

Read [README.md](README.md) completely before changing the public API, package behavior, supported runtimes, or user documentation.

Extend this guide only with stable, non-obvious conventions, architecture, contracts, workflows, and gotchas.
Do not catalog files or restate information evident from their names and locations.

## Scope

- Keep production code in `src/`.
- Keep focused module tests beside their source as `*.test.ts`.
- Keep integration, package-boundary, and type-inference tests in `tests/`.
- Import internal sources from `tests/` through the `#src/*` subpath import, never by relative paths into `src/`.
- Name compile-only tests `*.type-test.ts`.
- Keep `src/index.ts` limited to explicit public exports.
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

## Version policy

- Keep the minimum `@nuxt/test-utils` version in `src/config/versions.ts` equal to the lowest version in the `peerDependencies`.
- Update the supported versions in `README.md`, the `peerDependencies`, and the compatibility matrix in `.github/workflows/test-and-release.yml` together.

## Documentation

- Write public README and JSDoc text for package users who do not know the implementation.
- Add JSDoc to every exported declaration and to internal helpers whose contract, inputs, output, or failure behavior is not obvious.
- Add inline comments beside every non-obvious invariant, algorithmic choice, safety constraint, and intentionally limited behavior.
- Update nearby JSDoc and inline comments whenever the documented code changes, and remove comments that no longer apply.
- Do not narrate self-evident syntax or restate what a name already communicates.
- Do not document obvious or implied defaults.
- Describe a default only when readers need it to make a decision or avoid surprising behavior.
- Use One Sentence Per Line for connected prose.
- Keep semantically connected explanations as prose paragraphs.
- Use lists for separate assertions instead of presenting them as prose paragraphs.

## Changesets

- Before the first publication, update `.changeset/initial-release.md` instead of adding another changeset.
- Add one `.changeset/*.md` file for each independently releasable user-visible change.
- Do not add changesets for internal refactors, maintenance, tests, or documentation changes that do not require a package release.
- Choose the SemVer bump from the public contract: `patch` for backward-compatible fixes and `minor` for backward-compatible functionality.
- Before 1.0, use `minor` for breaking changes; starting with 1.0, use `major` and remove this rule.
- Create `.changeset/<unique-name>.md` with this format:

```markdown
---
"nuxt-vitest-shared-app": patch
---

Describe the user-visible change.
```

- Briefly describe the user-observable change or new capability in the public contract, without implementation details or rationale.
  Prefer a single sentence.
- Do not edit the package version or `CHANGELOG.md` by hand, and do not run `changeset version` or `changeset publish`; the release workflow consumes pending changesets.

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
