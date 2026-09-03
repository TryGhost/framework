# Agent Notes

## Repository Shape

This is a pnpm/Nx monorepo for `@tryghost/*` framework packages. The root
workspace owns shared tooling; package source, tests, and package READMEs live
under `packages/*`.

Use the repo-pinned package manager:

```bash
corepack pnpm install --frozen-lockfile
```

The local Node version is pinned in `.nvmrc` to Node 24. CI runs tests on Node
22 and Node 24, so avoid introducing APIs that do not work on Node 22 unless
the package support policy is changed deliberately.

## Common Commands

Run these from the repository root:

```bash
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test:ci
```

For a package-local loop:

```bash
cd packages/<package-name>
corepack pnpm test
corepack pnpm lint
```

Most package tests run with Vitest coverage. The shared coverage thresholds are
90% lines, 90% functions, 90% statements, and 80% branches. TypeScript packages
with source in `src/` need a package-level `vitest.config.ts` coverage include
that measures `src/**`.

## CI And Release Notes

The Test workflow installs with pnpm, checks formatting, runs oxlint, and runs
affected package tests on pull requests. Pushes to `main` run the full
`pnpm test:ci` suite. The stable required check is `All tests pass`.

Publishing is handled by `.github/workflows/publish.yml` after Nx release
commits. Use the root `pnpm ship:*` scripts for versioning; they run the
pre-ship test gate before creating release commits and tags.

The ship scripts release only the packages that changed. `scripts/ship.mjs`
compares each package against the git tag for its own current version and
passes the changed set to `nx release version --projects=...`; dependents are
pulled in by Nx's own `updateDependents: "auto"`. Run `pnpm ship:list` to see
what a ship would release without touching anything, or set `SHIP_ALL=1` to
force every package.

Do not hand `nx release version <bump>` an explicit specifier without
`--projects`. An explicit specifier disables change detection and bumps every
package in scope. `nx affected` is not a substitute here either: Nx treats any
`pnpm-lock.yaml` change as invalidating the whole graph, and renovate touches
the lockfile on every dependency PR.

## Cleanup Boundaries

Keep package-specific usage detail in the relevant package README. Add a root
`docs/` page only when the topic spans multiple packages and would make this
file or the root README hard to scan.

Generated build output, package `coverage/` folders, `node_modules/`, Nx cache,
and TypeScript build info are ignored. Do not commit generated artifacts unless
a package explicitly publishes that artifact from source control.
