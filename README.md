# Framework

## Install


## Usage


## Develop

This is a mono repository, managed with [Nx](https://nx.dev).

1. `git clone` this repo & `cd` into it as usual
2. run `yarn setup` from the top-level:
   - installs all external dependencies
   - links all internal dependencies

To add a new package to the repo:
   - install [slimer](https://github.com/TryGhost/slimer)
   - run `slimer new <package name>`


## Run

- `yarn dev`


## Test

- `yarn lint` run just eslint
- `yarn test` run lint and tests


## Publish

1. run one of the release commands in the top-level `framework` directory:
   - `yarn ship:patch`
   - `yarn ship:minor`
   - `yarn ship:major`
   - for initial Nx bootstrap in long-unreleased repos: `yarn ship:first-release`
2. this runs tests, versions packages, and creates/pushes release commit + tags
   - creates the version commit and pushes tags to `main`
3. CI automatically publishes the updated packages to npm via `.github/workflows/publish.yml`


# Copyright & License 

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
