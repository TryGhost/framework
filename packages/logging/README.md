# Logging

## Install

`npm install @tryghost/logging --save`

or

`pnpm add @tryghost/logging`

## Purpose

Ghost logging layer that configures logger instances, transports, and structured log formatting.

## Usage

## Shared singleton

The package's default export is a single `GhostLogger` instance. To survive
cases where the package fails to dedupe and more than one physical copy ends up
in the `node_modules` tree, that instance is cached on `globalThis` and reused
across every copy in the process. Without this, each copy would construct its
own logger and each `RotatingFileStream` would open the same log file —
multiple writers rotating one file corrupt it.

The cache is keyed on the **major** version only (`Symbol.for('@tryghost/logging@<major>')`),
so any `5.x` copies share one instance while an incompatible `6.x` gets its own.
Whichever copy loads first constructs the instance; later copies of the same
major reuse it as-is.

### ⚠️ Caution when adding methods

Because a `5.2` consumer can end up sharing an instance that was constructed by
a `5.1` copy that happened to load first, treat the instance's method surface as
**append-only within a major, and never assume a method exists just because the
current source has it**:

- Adding a new method in a minor/patch is fine, but a caller running against an
  older duplicate copy will hit `undefined` for it. New methods should be
  additive and callers should tolerate their absence (`typeof logger.foo === 'function'`)
  where a stale duplicate is plausible.
- New methods must work over state produced by an _older_ constructor of the
  same major. Do not rely on instance fields introduced in a newer constructor —
  the shared instance may not have them. Prefer degrading gracefully (as
  `flush()` does when a transport has no buffer) over throwing.
- Renaming, removing, or changing the behaviour/signature of an existing method
  is a breaking change and belongs in a **major** bump, which gets its own
  cache slot.

`resetForTesting()` clears the cached instance; it exists only so tests can force
a fresh logger, since the cache otherwise survives `require`-cache resets.

## Develop

This is a mono repository, managed with [Nx](https://nx.dev).

Follow the instructions for the top-level repo.

1. `git clone` this repo & `cd` into it as usual
2. Run `pnpm install` to install top-level dependencies.

## Run

- `pnpm dev`

## Test

- `pnpm lint` runs oxlint
- `pnpm test` runs lint and tests

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
