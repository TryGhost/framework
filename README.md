# Framework

Framework is a monorepo of `@tryghost/*` packages used across Ghost services,
apps, and tooling. Each package lives under `packages/*` and has its own README
with package-specific usage examples.

## Install

Use the repo-pinned package manager from the root of the checkout:

```bash
corepack pnpm install
```

For consumers, install the package you need from npm:

```bash
pnpm add @tryghost/<package-name>
```

## Usage

Read the package README for the package you are using. Common examples:

- [`@tryghost/api-framework`](packages/api-framework/README.md) for API request
  pipeline helpers.
- [`@tryghost/errors`](packages/errors/README.md) for shared Ghost error types.
- [`@tryghost/security`](packages/security/README.md) for token, password, and
  identifier helpers.
- [`@tryghost/express-test`](packages/express-test/README.md) for HTTP test
  helpers.

## Develop

This is a monorepo, managed with [Nx](https://nx.dev).

1. `git clone` this repo & `cd` into it as usual
2. run `pnpm setup` from the top-level:
    - installs all external dependencies
    - links all internal dependencies

To add a new package to the repo:

- install [slimer](https://github.com/TryGhost/slimer)
- run `slimer new <package name>`

## Run

- `pnpm dev` is a placeholder at the workspace root. Run package-specific
  scripts from the package directory when a package has a development workflow.

## Test

- `pnpm lint` runs `oxlint` across all packages
- `pnpm format` formats `js/ts/json/md` files with `oxfmt`
- `pnpm format:check` checks formatting without writing
- `pnpm test` runs package tests through Nx
- `pnpm test:ci` runs the full CI test target for every package

## Publish

1. run one of the release commands in the top-level `framework` directory:
    - `pnpm ship:patch`
    - `pnpm ship:minor`
    - `pnpm ship:major`
    - for initial Nx bootstrap in long-unreleased repos: `pnpm ship:first-release`
    - by default these bump **every** package in `packages/*` to the same level. To scope a release to specific packages, append `--projects=` with comma-separated npm package names (not directory names), e.g. `pnpm ship:minor --projects=@tryghost/api-framework,@tryghost/domain-events`
    - append `--dry-run` to preview which packages would be bumped without committing
2. this runs tests, versions packages, and creates/pushes release commit + tags
    - creates the version commit and pushes tags to `main`
3. CI automatically publishes packages via `.github/workflows/publish.yml`:
    - authenticates to npm via [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no long-lived tokens)
    - checks each `packages/*` package version against npm
    - runs `pnpm publish` (via `nx release publish`) only for versions that are not already published, with provenance attestations enabled

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
