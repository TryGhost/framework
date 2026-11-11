# Jest Snapshot

Jest-compatible snapshot testing for any test runner, powered by `@vitest/snapshot`

## Install

`npm install @tryghost/jest-snapshot --save`

or

`pnpm add @tryghost/jest-snapshot`

## Purpose

Snapshot assertion utilities and state management for Jest-style snapshots in non-Jest test suites.

## Usage

Snapshot files keep the Jest format (`// Jest Snapshot v1` header, `Object {` / `Array [` prefixes), so existing
`.snap` files continue to match without being rewritten. Set `SNAPSHOT_UPDATE=1` to update snapshots.

### Mocha

Register the root hooks, e.g. via `--require`:

```js
const { mochaHooks } = require('@tryghost/jest-snapshot');
exports.mochaHooks = mochaHooks;
```

### Other runners (e.g. Vitest)

Snapshot files are loaded and saved asynchronously, while matching stays synchronous. Wire the manager into your
runner's hooks and await the async calls:

```js
const { snapshotManager } = require('@tryghost/jest-snapshot');

beforeAll(() => snapshotManager.resetRegistry());

beforeEach(async (context) => {
    // Build a mocha-style full title: every describe name plus the test name
    const titleParts = [context.task.name];
    for (let suite = context.task.suite; suite && suite.name; suite = suite.suite) {
        titleParts.unshift(suite.name);
    }

    await snapshotManager.setCurrentTest({
        testPath: context.task.file.filepath,
        testTitle: titleParts.join(' '),
    });
});

afterAll(() => snapshotManager.saveSnapshots());
```

`snapshotManager.match(received, properties, hint)` and `snapshotManager.assertSnapshot(...)` require the current
test's snapshot file to be loaded (`await setCurrentTest(...)` or `await snapshotManager.ready()`).

Asymmetric matchers for property matching are exported as `any`, `anything` and `stringMatching`.

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
