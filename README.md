# Framework

## Install


## Usage


## Develop

This is a mono repository, managed with [Nx](https://nx.dev).

1. `git clone` this repo & `cd` into it as usual
2. run `pnpm setup` from the top-level:
   - installs all external dependencies
   - links all internal dependencies

To add a new package to the repo:
   - install [slimer](https://github.com/TryGhost/slimer)
   - run `slimer new <package name>`


## Run

- `pnpm dev`


## Test

- `pnpm lint` runs `oxlint` across all packages
- `pnpm format` formats `js/ts/json/md` files with `oxfmt`
- `pnpm format:check` checks formatting without writing
- `pnpm test` runs tests (most packages also run lint in `posttest`)


## Publish

1. run one of the release commands in the top-level `framework` directory:
   - `pnpm ship:patch`
   - `pnpm ship:minor`
   - `pnpm ship:major`
   - for initial Nx bootstrap in long-unreleased repos: `pnpm ship:first-release`
2. this runs tests, versions packages, and creates/pushes release commit + tags
   - creates the version commit and pushes tags to `main`
3. CI automatically publishes packages via `.github/workflows/publish.yml`:
   - authenticates to npm via [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no long-lived tokens)
   - checks each `packages/*` package version against npm
   - runs `pnpm publish` (via `nx release publish`) only for versions that are not already published, with provenance attestations enabled


# Copyright & License 

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
