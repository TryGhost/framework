# Framework Migration Plan

## Overview

Three major migrations for the TryGhost framework monorepo (44 packages):

1. **Vitest Migration** — Replace Mocha with Vitest
2. **TypeScript + ESM Migration** — Convert JS/CJS packages to TypeScript/ESM
3. **Lodash Removal** — Replace Lodash with native JS

**Recommended order:** Vitest → TypeScript+ESM → Lodash (Lodash can run in parallel)

---

## 1. Vitest Migration — COMPLETE

All 42 packages migrated from Mocha 11.7.5 + c8 to Vitest 3.1.1 + @vitest/coverage-v8.

### Configuration

**Root config** (`vitest.config.ts`): Shared defaults — globals enabled, node environment, v8 coverage at 90% thresholds. Standard packages reference this via `--config ../../vitest.config.ts`.

**6 packages have local `vitest.config.ts` overrides:**

| Package | Override | Reason |
|---------|----------|--------|
| **express-test** | `setupFiles: ['./test/utils/overrides.js']`, 0% thresholds | Setup file initializes snapshot test registry before each test. Coverage was never enforced under mocha. |
| **http-cache-utils** | 0% thresholds | Coverage was never enforced under mocha. |
| **webhook-mock-receiver** | 0% thresholds | Coverage was never enforced under mocha. |
| **errors** | `coverage.include: ['src/**']` | TypeScript package with source in `src/` not `lib/`. |
| **prometheus-metrics** | `coverage.include: ['src/**']` | TypeScript package with source in `src/` not `lib/`. |
| **job-manager** | `dangerouslyIgnoreUnhandledErrors: true` | Bree spawns background workers that emit unhandled rejections during cleanup after tests complete. These are expected and were silently ignored by Mocha. |

### Key migration notes

- Mocha's `before`/`after` become Vitest's `beforeAll`/`afterAll`. ESLint `plugin:ghost/test` uses `env: { mocha: true }` which doesn't include these globals, so 5 test `.eslintrc.js` files add them explicitly.
- 87 `done()` callback patterns across 9 test files were converted to `async`/`await` with `new Promise`.
- `express-test/test/utils/overrides.js` uses arrow functions and top-level hooks (vitest setup file pattern) with ESLint disable comments for the mocha lint rules.
- Vitest sets `process.env.MODE = 'test'` which conflicted with `@tryghost/metrics` — cleaned up in beforeEach/afterEach.

---

## 2. TypeScript + ESM Migration

Combined TypeScript + ESM conversion for all packages. Packages move from `lib/*.js` (CJS) to `src/*.ts` (ESM) in a single pass.

### Configuration

**Shared base** (`packages/tsconfig.json`):
- `strict: true`, `module: "node16"`, `moduleResolution: "node16"`
- `verbatimModuleSyntax: true`, `isolatedModules: true`
- `target: "es2022"`, `declaration: true`, `sourceMap: true`

**Per-package** (`packages/<name>/tsconfig.json`):
- Extends `../tsconfig.json`
- Sets `rootDir: "src"`, `outDir: "build"`

**Per-package `package.json` pattern:**
- `"type": "module"`
- `"main": "build/index.js"`, `"types": "build/index.d.ts"`
- `"exports": { ".": { "types": "./build/index.d.ts", "default": "./build/index.js" } }`
- Scripts: `build: "tsc"`, `test: "yarn test:types && vitest run --config ../../vitest.config.ts"`

### Key patterns

- **CJS deps with `export =`**: Use `import X = require('module')` (required by `verbatimModuleSyntax`)
- **Untyped deps**: Add `src/libraries.d.ts` with ambient declarations
- **Node.js builtins**: Use `node:` prefix (e.g., `import fs from 'node:fs'`)
- **Relative imports**: Must use `.js` extension (e.g., `import foo from './foo.js'`)
- **JSON loading in ESM**: Use `createRequire(import.meta.url)` pattern

### Existing TS packages (need ESM conversion only)

- [ ] **errors** — Currently CJS TypeScript with esbuild. Needs ESM conversion.
- [ ] **prometheus-metrics** — Currently CJS TypeScript with tsc. Needs ESM conversion.

### Wave 1 — Leaf Packages (11 packages) — COMPLETE

No internal `@tryghost/*` dependencies. Committed on `ts-esm-migration` branch.

- [x] tpl
- [x] http-cache-utils
- [x] root-utils
- [x] promise
- [x] email-mock-receiver
- [x] webhook-mock-receiver
- [x] pretty-cli
- [x] security
- [x] database-info
- [x] mw-vhost
- [x] pretty-stream

### Wave 2 — Internal Dependencies (6 packages) — IN PROGRESS

Depend on Wave 1 packages. Conversion complete, stashed pending Wave 1 merge.

- [x] debug (depends on: root-utils)
- [x] config (depends on: root-utils)
- [x] version (depends on: root-utils)
- [x] validator (depends on: tpl)
- [x] jest-snapshot (no internal deps, but complex package)
- [x] elasticsearch (depends on: debug)

### Wave 3 — Mid-level Packages (10 packages) — TODO

- [ ] nodemailer
- [ ] zip
- [ ] domain-events
- [ ] parse-email-address
- [ ] request
- [ ] http-stream
- [ ] mw-error-handler
- [ ] express-test
- [ ] job-manager
- [ ] api-framework

### Wave 4 — Upper-level Packages — TODO

- [ ] logging (depends on: debug, config, pretty-stream, elasticsearch)
- [ ] metrics
- [ ] server

### Wave 5 — Bookshelf Packages (10 packages) — TODO

Need shared `bookshelf-types.d.ts` for ambient Bookshelf/Knex types.

- [ ] bookshelf-collision
- [ ] bookshelf-eager-load
- [ ] bookshelf-filter
- [ ] bookshelf-has-posts
- [ ] bookshelf-include-count
- [ ] bookshelf-order
- [ ] bookshelf-pagination
- [ ] bookshelf-plugins
- [ ] bookshelf-cursor-pagination
- [ ] bookshelf-manager

### Remaining packages — TODO

- [ ] config-url-helpers
- [ ] custom-redirects
- [ ] dynamic-routing-events
- [ ] email-analytics-provider-mailgun
- [ ] email-analytics-service
- [ ] extract-api-key
- [ ] magic-link
- [ ] mailgun-client
- [ ] member-events
- [ ] members-csv
- [ ] members-importer
- [ ] metrics-server
- [ ] minifier
- [ ] moleculer-service-from-class
- [ ] mw-api-version-mismatch
- [ ] mw-cache-control
- [ ] mw-session-from-token
- [ ] nql
- [ ] session-service
- [ ] staff-service
- [ ] adapter-manager
- [ ] verification-trigger
- [ ] version-notifications-data-service

---

## 3. Lodash Removal

### Current State

| Metric | Value |
|--------|-------|
| Packages using lodash | 13 |
| Files using lodash | ~22 |
| Unique functions used | ~35 |
| lodash version | 4.17.23 |

### Function Inventory by Replacement Difficulty

#### Easy — Direct Native Replacements

| Lodash Function | Native Replacement | Usage Count |
|----------------|-------------------|-------------|
| `_.isString(x)` | `typeof x === 'string'` | 1 |
| `_.isArray(x)` | `Array.isArray(x)` | 3 |
| `_.isObject(x)` | `typeof x === 'object' && x !== null` | 1 |
| `_.isNumber(x)` | `typeof x === 'number'` | 1 |
| `_.isBoolean(x)` | `typeof x === 'boolean'` | 1 |
| `_.isNil(x)` | `x === null \|\| x === undefined` | 1 |
| `_.isEmpty(x)` | `Object.keys(x).length === 0` / `x.length === 0` | 7 |
| `_.each(arr, fn)` | `arr.forEach(fn)` / `for...of` | 6 |
| `_.map(arr, fn)` | `arr.map(fn)` | 1 |
| `_.filter(arr, fn)` | `arr.filter(fn)` | 1 |
| `_.find(arr, fn)` | `arr.find(fn)` | 1 |
| `_.includes(arr, v)` | `arr.includes(v)` | 1 |
| `_.toString(x)` | `String(x)` | 1 |
| `_.defaults(obj, def)` | `{ ...defaults, ...obj }` | 1 |
| `_.extend(a, b)` | `Object.assign(a, b)` | 1 |

#### Medium — Small Utility Needed

| Lodash Function | Native Replacement | Usage Count |
|----------------|-------------------|-------------|
| `_.pick(obj, keys)` | `Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)))` | 6 |
| `_.omit(obj, keys)` | `Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)))` | 2 |
| `_.cloneDeep(x)` | `structuredClone(x)` | 4 |
| `_.merge(a, b)` | `Object.assign()` for shallow, custom for deep | 2 |
| `_.result(obj, path)` | `typeof obj[path] === 'function' ? obj[path]() : obj[path]` | 6 |
| `_.forOwn(obj, fn)` | `Object.entries(obj).forEach(([k,v]) => fn(v,k))` | 2 |
| `_.has(obj, key)` | `Object.hasOwn(obj, key)` | 2 |
| `_.uniq(arr)` | `[...new Set(arr)]` | 1 |
| `_.intersection(a, b)` | `a.filter(x => b.includes(x))` | 1 |

#### Hard — Consider Keeping

| Lodash Function | Notes | Usage Count |
|----------------|-------|-------------|
| `_.get(obj, path, def)` | Optional chaining + `??` works for most cases, but deep string paths need a helper | 4 |
| `lodash.template` | Used in `tpl` package — core templating. Would need a replacement library or custom impl | 2 |

### Migration Steps by Package

#### Phase 1: Easy Wins (type checks and array methods)
- [ ] **bookshelf-collision** — uses: `_.each`
- [ ] **bookshelf-eager-load** — uses: `_.each`
- [ ] **bookshelf-has-posts** — uses: `_.each`
- [ ] **bookshelf-include-count** — uses: `_.each`, `_.intersection`
- [ ] **bookshelf-order** — uses: `_.each`

#### Phase 2: Medium Complexity
- [x] **pretty-stream** — uses: `_.isObject`, `_.isNumber`, `_.isBoolean`, `_.isNil`, `_.isEmpty`, `_.isString`, `_.toString`, `_.each`, `_.has` — **Replaced during TS conversion**
- [ ] **request** — uses: `_.extend`
- [ ] **mw-error-handler** — uses: `_.merge`

#### Phase 3: Heavier Usage
- [ ] **api-framework** (5 files) — uses: `_.pick`, `_.omit`, `_.result`, `_.isEmpty`, `_.isArray`, `_.cloneDeep`, `_.each`, `_.filter`, `_.find`, `_.map`, `_.includes`, `_.forOwn`
- [ ] **validator** (2 files) — uses: `_.isEmpty`, `_.isString`, `_.isArray`, `_.each`, `_.has`
- [ ] **logging** (2 files) — uses: `_.cloneDeep`, `_.isEmpty`, `_.each`
- [ ] **bookshelf-pagination** — uses: `_.pick`, `_.defaults`, `_.omit`

#### Phase 4: Special Cases
- [ ] **tpl** — uses `lodash.template` (separate npm package). Options:
  - Keep `lodash.template` as standalone dependency (it's small)
  - Replace with a lightweight template library
  - Write a simple template function if usage is basic
- [ ] **errors** — lodash is only in devDependencies (+ @types/lodash). Check if it's actually used in tests

---

## Progress Tracking

### Vitest Migration: COMPLETE (42/42 packages)
### TypeScript + ESM Migration: 13/44 packages (Wave 1 complete, Wave 2 stashed)
### Lodash Removal: 1/13 packages (pretty-stream done during TS conversion)
