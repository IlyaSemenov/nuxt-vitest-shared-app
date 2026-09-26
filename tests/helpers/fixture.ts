import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export const rootDir = fileURLToPath(new URL("../..", import.meta.url))
export const fixtureDir = join(rootDir, "tests/fixtures/app")

/** Set when the whole suite runs in native mode against an upstream release. */
export const nativeSuite = process.env.FIXTURE_STARTUP_MODE === "native"

const startupModeEnv: Record<string, string> = nativeSuite ? { STARTUP_MODE: "native" } : {}

/** Outcome of one fixture test. */
export interface FixtureTest {
  status: string
  errors: string
}

/** Outcome of a fixture run. */
export interface FixtureRun {
  exitCode: number | null
  output: string
  /** Tests by `<file> > <full name>`, with the file relative to the fixture. */
  tests: Map<string, FixtureTest>
  /**
   * Returns the test with this full name in `file`, or in any file when the name is unique in the run.
   *
   * @throws When `file` is omitted and several files have a test with this name.
   */
  test(name: string, file?: string): FixtureTest | undefined
  /** Errors of suites that failed as a whole, e.g. in `beforeAll`, by file name. */
  suiteErrors: Map<string, string>
  /** Values printed by the fixture's `report()` helper under `key`. */
  reports(key: string): unknown[]
}

interface JsonReport {
  testResults: Array<{
    name: string
    message: string
    assertionResults: Array<{ fullName: string; status: string; failureMessages: string[] }>
  }>
}

/**
 * Runs one fixture scenario in a separate Vitest process.
 *
 * `env` selects scenario variants, see `tests/fixtures/app/vitest.config.ts` and `testing/probe-plugin.ts`.
 * `FIXTURE_STARTUP_MODE=native` runs every scenario with the installed upstream entry, to qualify a release with native app reuse.
 */
export async function runFixture(
  scenario: string,
  env: Record<string, string> = {},
): Promise<FixtureRun> {
  const outputDir = await mkdtemp(join(tmpdir(), "nuxt-vitest-shared-app-"))
  const outputFile = join(outputDir, "report.json")
  // Variables of the outer Vitest process would leak into the inner one.
  const parentEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("VITEST") && key !== "NODE_ENV"),
  )
  const child = spawn(
    process.execPath,
    [
      join(rootDir, "node_modules/vitest/vitest.mjs"),
      "run",
      "--reporter=verbose",
      "--reporter=json",
      `--outputFile.json=${outputFile}`,
    ],
    {
      cwd: fixtureDir,
      env: {
        ...parentEnv,
        NO_COLOR: "1",
        VITE_CONFIG_NATIVE_IGNORE_WARNING: "true",
        SCENARIO: scenario,
        ...startupModeEnv,
        ...env,
      },
    },
  )
  let output = ""
  child.stdout.on("data", (chunk) => (output += chunk))
  child.stderr.on("data", (chunk) => (output += chunk))
  const exitCode = await new Promise<number | null>((resolve) => child.on("close", resolve))

  let report: JsonReport
  try {
    report = JSON.parse(await readFile(outputFile, "utf8")) as JsonReport
  } catch {
    throw new Error(`Fixture scenario "${scenario}" produced no report:\n${output}`)
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }

  const tests = new Map<string, FixtureTest>()
  const suiteErrors = new Map<string, string>()
  for (const file of report.testResults) {
    const fileName = file.name.slice(fixtureDir.length + 1)
    if (file.message) suiteErrors.set(fileName, file.message)
    for (const test of file.assertionResults) {
      tests.set(`${fileName} > ${test.fullName}`, {
        status: test.status,
        errors: test.failureMessages.join("\n"),
      })
    }
  }
  return {
    exitCode,
    output,
    tests,
    test(name, file) {
      if (file) return tests.get(`${file} > ${name}`)
      const matches = [...tests].filter(([key]) => key.endsWith(` > ${name}`))
      if (matches.length > 1) {
        throw new Error(`Several fixture files have a test named "${name}"; pass the file.`)
      }
      return matches[0]?.[1]
    },
    suiteErrors,
    reports: (key) =>
      [...output.matchAll(new RegExp(`^report:${key} (.*)$`, "gm"))].map((match) =>
        JSON.parse(match[1]!),
      ),
  }
}

/** Asserts that the run passed with at least one test and no failures. */
export function expectPassed(run: FixtureRun) {
  const failed = [...run.tests].filter(([, test]) => test.status !== "passed")
  if (run.exitCode !== 0 || failed.length || !run.tests.size) {
    throw new Error(`Fixture run did not pass (exit code ${run.exitCode}):\n${run.output}`)
  }
}
