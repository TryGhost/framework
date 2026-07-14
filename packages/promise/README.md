# Promise

## Install

`npm install @tryghost/promise --save`

or

`pnpm add @tryghost/promise`

## Purpose

Small async utility module with `pipeline`, `sequence`, and `pool` helpers for Promise workflows.

## Usage

```js
const { pipeline, sequence, pool } = require('@tryghost/promise');
```

### `pipeline(tasks, ...args)`

Runs tasks in order. First task receives `args`; each later task receives previous task's result. Promise arguments resolve before first task runs. Resolves with final task result.

```js
const greeting = await pipeline(
    [async (userId) => ({ id: userId, name: 'Maya' }), (user) => `Hello, ${user.name}!`],
    Promise.resolve('user-123'),
);

// 'Hello, Maya!'
```

If a task returns an array, the next task receives the values as separate arguments:

```js
const total = await pipeline([() => [2, 3], (left, right) => left + right]);

// 5
```

### `sequence(tasks, ...args)`

Runs tasks one at time, in order. Every task receives same `args`. Resolves with array of results in task order. Tasks may return values or promises.

```js
const results = await sequence(
    [async (userId) => `loaded ${userId}`, (userId) => `audited ${userId}`],
    'user-123',
);

// ['loaded user-123', 'audited user-123']
```

### `pool(tasks, maxConcurrent)`

Runs task functions with at most `maxConcurrent` tasks active at once. Resolves with results in input order, even when tasks finish out of order. `maxConcurrent` must be at least `1`.

```js
const pages = await pool(
    [
        () => fetch('/api/pages/1').then((response) => response.json()),
        () => fetch('/api/pages/2').then((response) => response.json()),
        () => fetch('/api/pages/3').then((response) => response.json()),
    ],
    2,
);

// Results for pages 1, 2, and 3, in that order.
```

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
