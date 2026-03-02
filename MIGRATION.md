# Framework Migration Plan

## Overview

Three major migrations for the TryGhost framework monorepo (44 packages):

1. **Vitest Migration** — Replace Mocha with Vitest
2. **TypeScript Migration** — Convert JS packages to TypeScript
3. **Lodash Removal** — Replace Lodash with native JS

**Recommended order:** Vitest → TypeScript → Lodash (Lodash can run in parallel)

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

## 2. TypeScript Migration

### Current State

| Metric | Value |
|--------|-------|
| TypeScript packages | 2 (errors, prometheus-metrics) |
| JavaScript packages | 42 |
| Shared tsconfig | packages/tsconfig.json (ES2022, commonjs, strict) |
| Build tools | esbuild + tsc (errors), tsc only (prometheus-metrics) |

### Existing TypeScript Package Patterns

**@tryghost/errors (esbuild + tsc):**
- Source: `/src/*.ts`
- Output: `/cjs/` (CommonJS via esbuild), `/es/` (ESM via esbuild), `/types/` (declarations via tsc)
- Dual CJS/ESM output

**@tryghost/prometheus-metrics (tsc only):**
- Source: `/src/*.ts`
- Output: `/build/`
- Single CJS output with declarations

### Decisions Needed

- [ ] **Build strategy:** Standardize on esbuild+tsc (fast builds, dual output) or tsc-only (simpler)?
- [ ] **Strictness:** Start with `strict: true` (match existing tsconfig) or `strict: false` + `allowJs: true` for gradual migration?
- [ ] **Module format:** Keep commonjs or move to ESM? (Current tsconfig targets commonjs)

### Migration Steps

#### Step 1: Standardize Build Infrastructure
- [ ] Decide on build strategy
- [ ] Create a shared tsconfig base that all packages extend
- [ ] Create a package template/script for conversion

#### Step 2: Wave 1 — Leaf Packages (simple, few/no dependents)
- [ ] tpl (1 source file)
- [ ] limit (2 source files)
- [ ] color-utils (1 source file)
- [ ] root-utils (1 source file)
- [ ] timezone-data (1 source file)
- [ ] string (1 source file)
- [ ] debug (1 source file)
- [ ] parse-email-address

#### Step 3: Wave 2 — Small Utility Packages
- [ ] validator (2 source files)
- [ ] pretty-stream (1 source file)
- [ ] config-url-helpers (2 source files)
- [ ] extract-api-key (1 source file)
- [ ] http-cache-utils (1 source file)
- [ ] minifier (1 source file)
- [ ] nql (1 source file)

#### Step 4: Wave 3 — Medium Packages
- [ ] logging (2 source files)
- [ ] request (1 source file)
- [ ] security (6 source files)
- [ ] express-test
- [ ] custom-redirects
- [ ] members-csv
- [ ] zip
- [ ] http-stream

#### Step 5: Wave 4 — Bookshelf Plugins (7 packages)
- [ ] bookshelf-collision
- [ ] bookshelf-eager-load
- [ ] bookshelf-filter
- [ ] bookshelf-has-posts
- [ ] bookshelf-include-count
- [ ] bookshelf-order
- [ ] bookshelf-pagination
- [ ] bookshelf-plugins

#### Step 6: Wave 5 — Core/Complex Packages
- [ ] api-framework (16 source files — largest package)
- [ ] domain-events
- [ ] job-manager
- [ ] magic-link
- [ ] session-service
- [ ] staff-service
- [ ] mw-error-handler
- [ ] mw-vhost
- [ ] mw-session-from-token
- [ ] mw-api-version-mismatch
- [ ] mw-cache-control
- [ ] adapter-manager
- [ ] dynamic-routing-events
- [ ] email-analytics-provider-mailgun
- [ ] email-analytics-service
- [ ] mailgun-client
- [ ] member-events
- [ ] members-importer
- [ ] metrics-server
- [ ] moleculer-service-from-class
- [ ] verification-trigger
- [ ] version-notifications-data-service

#### Per-Package Conversion Checklist
For each package:
- [ ] Create/extend `tsconfig.json` from shared base
- [ ] Rename `lib/*.js` → `src/*.ts` (or `lib/*.ts` — decide on convention)
- [ ] Add type annotations
- [ ] Add `build` script to package.json
- [ ] Update `main`, `types`, and `exports` in package.json
- [ ] Convert test files from `.test.js` → `.test.ts`
- [ ] Update `.gitignore` for build output
- [ ] Verify tests pass with 100% coverage
- [ ] Update any packages that import from this one

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
- [ ] **bookshelf-pagination** — uses: `_.pick`, `_.defaults`, `_.omit`
- [ ] **pretty-stream** — uses: `_.isObject`, `_.isNumber`, `_.isBoolean`, `_.isNil`, `_.isEmpty`, `_.isString`, `_.toString`, `_.each`, `_.has`
- [ ] **request** — uses: `_.extend`
- [ ] **mw-error-handler** — uses: `_.merge`

#### Phase 3: Heavier Usage
- [ ] **api-framework** (5 files) — uses: `_.pick`, `_.omit`, `_.result`, `_.isEmpty`, `_.isArray`, `_.cloneDeep`, `_.each`, `_.filter`, `_.find`, `_.map`, `_.includes`, `_.forOwn`
- [ ] **validator** (2 files) — uses: `_.isEmpty`, `_.isString`, `_.isArray`, `_.each`, `_.has`
- [ ] **logging** (2 files) — uses: `_.cloneDeep`, `_.isEmpty`, `_.each`

#### Phase 4: Special Cases
- [ ] **tpl** — uses `lodash.template` (separate npm package). Options:
  - Keep `lodash.template` as standalone dependency (it's small)
  - Replace with a lightweight template library
  - Write a simple template function if usage is basic
- [ ] **errors** — lodash is only in devDependencies (+ @types/lodash). Check if it's actually used in tests

#### Per-Package Checklist
For each package:
- [ ] Replace lodash calls with native equivalents
- [ ] Run tests to verify behavior matches
- [ ] Remove `lodash` from `dependencies` in package.json
- [ ] Remove `@types/lodash` from devDependencies if present
- [ ] Verify 100% coverage still passes

---

## Progress Tracking

### Vitest Migration: COMPLETE (42/42 packages)
### TypeScript Migration: 2/44 packages
### Lodash Removal: 0/13 packages
