# TypeScript + ESM Migration Guide

## Overview

Convert 40 JavaScript/CJS packages to TypeScript ESM (`strict: true`, `tsc` builds, native ES modules).

Two packages are already TypeScript: `errors` (dual CJS/ESM) and `prometheus-metrics` (CJS). Both will be updated to ESM as part of this migration. One package (`domain-events`) has a hand-written `.d.ts` that will be replaced by generated types.

**Why combined TS + ESM?** Every package is being touched anyway (renaming files, rewriting imports). Adding ESM is marginal extra work per package and avoids a second migration pass. Ghost requires Node ^22.13.1, which supports `require()` of ESM modules natively — so Ghost's existing CJS `require('@tryghost/*')` calls continue to work without changes.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Strictness | `strict: true` | Matches existing tsconfig; maximum type safety |
| Build tool | `tsc` only | Simpler than esbuild+tsc; sufficient for single-format output |
| Module format | ESM | Modern standard; tree-shakeable; Ghost on Node 22.13+ can `require()` ESM |
| Output directory | `build/` | Matches prometheus-metrics pattern |
| Source directory | `src/` | Matches both existing TS packages |
| Convert tests? | Yes, `.test.ts` | Full type safety; catches API contract issues |
| `isolatedModules` | `true` | Ensures compatibility with Vitest/esbuild/SWC |
| `verbatimModuleSyntax` | `true` | Viable with ESM; enforces explicit `import type`; catches real bugs |
| `exports` field | Yes | Modern Node.js standard; required for proper ESM resolution |
| Type-check in CI | `tsc --noEmit` in test script | Catches type errors without build |
| Bookshelf plugins | Pragmatic — shared ambient `.d.ts`, `any` for dynamic internals | Bookshelf has no types; full typing isn't feasible |
| `errors` package | Update to ESM-only tsc build (drop esbuild dual output) | Aligns with all other packages; dual output no longer needed |
| `prometheus-metrics` | Update to ESM, extend shared tsconfig | Align with standard pattern |

---

## Shared Base Configuration

**Location:** `packages/tsconfig.json`

Replace the existing shared config with:

```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "module": "node16",
    "moduleResolution": "node16",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  }
}
```

**Changes from current:**
- `module` changed from `commonjs` to `node16`
- Added `moduleResolution: "node16"` (required with `module: "node16"`)
- Added `isolatedModules: true`
- Added `verbatimModuleSyntax: true` (viable now that we target ESM)
- Removed `esModuleInterop` (not needed with ESM + `verbatimModuleSyntax`)
- Removed `"mocha"` from `types` (Vitest globals are injected differently)
- Removed redundant `noImplicitAny` (already implied by `strict`)
- Removed `incremental: false` (let packages opt in)
- Removed `ts-node` config (move to per-package where needed)
- Removed all commented-out options (clean base)

**NOT in base config (must be per-package):**
- `rootDir` / `outDir` — resolved relative to the config file they're defined in, so they must be in each package's own tsconfig
- `include` — same reason; paths resolve relative to the defining config

---

## Per-Package tsconfig.json Template

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "build"
  },
  "include": ["src/**/*"]
}
```

All packages use this exact config unless they have a specific override need.

---

## Per-Package package.json Changes

### Before (JS/CJS)
```json
{
  "main": "index.js",
  "scripts": {
    "test": "...",
    "lint": "eslint . --ext .js --cache"
  },
  "files": ["index.js", "lib"]
}
```

### After (TS/ESM)
```json
{
  "type": "module",
  "main": "build/index.js",
  "types": "build/index.d.ts",
  "exports": {
    ".": {
      "types": "./build/index.d.ts",
      "default": "./build/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "prepare": "tsc",
    "test:types": "tsc --noEmit",
    "test": "yarn test:types && vitest run --config ../../vitest.config.ts",
    "lint": "eslint src/ --ext .ts --cache"
  },
  "files": ["build"],
  "devDependencies": {
    "typescript": "5.9.3"
  }
}
```

**Notes:**
- `"type": "module"` declares the package as ESM
- `exports.".".types` must come first (TypeScript requires this ordering)
- `main` and `types` kept alongside `exports` for backward compatibility with older resolvers
- `prepare` runs `tsc` so consuming packages get built output after `yarn install`
- `files` only includes `build/` — source stays out of published package

---

## ESM-Specific Changes Per Package

When converting each package, these ESM changes are needed in addition to TypeScript conversion:

### 1. File extensions in imports

All relative imports must include `.js` extensions (TypeScript resolves these to `.ts` source files during compilation, but the emitted JS needs the extension):

```typescript
// Before (CJS)
const { foo } = require('./utils');

// After (ESM + TypeScript)
import { foo } from './utils.js';
```

### 2. Type-only imports use `import type`

`verbatimModuleSyntax` enforces this — type-only imports must be explicit:

```typescript
// Runtime import (kept in output)
import { someFunction } from './utils.js';

// Type-only import (erased from output)
import type { SomeInterface } from './types.js';

// Mixed — named type imports within a regular import
import { someFunction, type SomeInterface } from './utils.js';
```

### 3. Replace `__dirname` / `__filename`

Node 21.2+ provides `import.meta.dirname` and `import.meta.filename`:

```typescript
// Before (CJS)
const root = path.join(__dirname, '..');

// After (ESM) — Node 21.2+
const root = path.join(import.meta.dirname, '..');
```

Only ~2 packages use these (`root-utils`, `debug`).

### 4. Replace `require()` calls

```typescript
// Before (CJS)
const pkg = require('./package.json');
const dep = require('some-dep');

// After (ESM) — static import
import pkg from './package.json' with { type: 'json' };
import dep from 'some-dep';

// After (ESM) — dynamic import (when conditional/lazy loading is needed)
const dep = await import('some-dep');
```

JSON imports use the `with { type: 'json' }` import attribute (Node 22+).

### 5. Replace `module.exports`

```typescript
// Before (CJS)
module.exports = { foo, bar };
module.exports = MyClass;

// After (ESM + TypeScript)
export { foo, bar };
export default MyClass;
```

### 6. CJS-only external dependencies

Most CJS packages work fine as default imports from ESM:

```typescript
// CJS package: module.exports = function() { ... }
import bookshelf from 'bookshelf';
import Bree from 'bree';
import bunyan from 'bunyan';
```

If a CJS package exports an object and named import detection fails, fall back to:

```typescript
import pkg from 'some-cjs-package';
const { foo, bar } = pkg;
```

This is rare with well-known packages.

---

## Per-Package Conversion Checklist

For each package:

1. **Create `tsconfig.json`** — extend shared base, set `rootDir`/`outDir`
2. **Add `"type": "module"`** to `package.json`
3. **Move source** — `lib/*.js` → `src/*.ts` (and `index.js` → `src/index.ts`)
4. **Convert to ESM syntax** — `require()` → `import`, `module.exports` → `export`
5. **Add `.js` extensions** to all relative imports
6. **Add type annotations** — parameters, return types, interfaces for options objects
7. **Use `import type`** for type-only imports (`verbatimModuleSyntax` enforces this)
8. **Replace `__dirname`/`__filename`** with `import.meta.dirname`/`import.meta.filename` where used
9. **Rename tests** — `test/*.test.js` → `test/*.test.ts`, convert to ESM imports
10. **Install `@types/*`** — for external deps that don't ship types. If no `@types/*` exists, create a local `libraries.d.ts` ambient declaration in `src/`
11. **Update `package.json`** — `main`, `types`, `exports`, `files`, `type`, scripts (see template above)
12. **Add `typescript`** to `devDependencies`
13. **Run `tsc --noEmit`** — fix all type errors
14. **Run tests** — verify all pass with coverage
15. **Delete old files** — remove `lib/`, old `index.js`, any hand-written `.d.ts`

---

## Bookshelf Plugin Strategy

The 10 Bookshelf packages use dynamic prototype extension and `this` binding that can't be fully typed. Bookshelf ships no types and `@types/bookshelf` is unmaintained.

**Approach:**
1. Create a shared `packages/bookshelf-types.d.ts` with ambient declarations for the subset of Bookshelf APIs actually used by the plugins (Model, Collection, query builder, sync/save/fetch patterns)
2. Convert plugins to `.ts` using these ambient types
3. Use `any` for truly dynamic patterns (prototype manipulation, `this` in extended methods)
4. Each bookshelf plugin's `tsconfig.json` references the shared declarations

This gives consistency (all packages are TypeScript) while accepting that Bookshelf internals can't be fully typed.

---

## Migration Waves

Waves follow the dependency graph — each wave's packages only depend on packages from earlier waves (or already-TypeScript packages). Within each wave, packages are ordered simplest first.

### Already TypeScript (update to ESM + align with shared config)
- **`errors`** — Drop esbuild dual CJS/ESM build. Switch to tsc-only ESM. Update tsconfig (already extends shared). Update package.json (`type: "module"`, remove `cjs/`/`es/`/`types/` output dirs, use `build/`).
- **`prometheus-metrics`** — Switch to ESM. Update tsconfig to extend shared base. Update package.json (`type: "module"`).

### Wave 1 — Leaf Packages (no internal dependencies) — 15 packages

These can all be converted independently, in any order.

| # | Package | Source files | Lines | Complexity | Notes |
|---|---------|-------------|-------|------------|-------|
| 1 | `tpl` | 1 | 27 | Very Low | Uses `lodash.template` |
| 2 | `http-cache-utils` | 1 | 37 | Very Low | JSDoc already present |
| 3 | `root-utils` | 1 | 52 | Low | Uses `__dirname` — needs `import.meta.dirname` |
| 4 | `promise` | 3 | 70 | Low | Good generics opportunity |
| 5 | `security` | 6 | ~150 | Medium | Crypto utilities |
| 6 | `email-mock-receiver` | 1 | small | Low | Test utility |
| 7 | `webhook-mock-receiver` | 1 | small | Low | Test utility |
| 8 | `pretty-cli` | 1 | small | Low | CLI wrapper |
| 9 | `database-info` | 1 | 122 | Medium | Knex types available |
| 10 | `mw-vhost` | 1 | 171 | Medium | Express middleware |
| 11 | `pretty-stream` | 1 | 229 | High | Transform stream, lodash |
| 12 | `bookshelf-custom-query` | 1 | small | Low* | Bookshelf plugin |
| 13 | `bookshelf-order` | 1 | small | Low* | Bookshelf plugin |
| 14 | `bookshelf-search` | 1 | small | Low* | Bookshelf plugin |
| 15 | `bookshelf-transaction-events` | 1 | small | Low* | Bookshelf plugin |

*\*Low complexity for the code itself; Bookshelf typing adds overhead (see strategy above).*

### Wave 2 — Level 1 Dependencies (depend on leaves + errors) — 12 packages

| # | Package | Internal deps | Notes |
|---|---------|--------------|-------|
| 1 | `debug` | `root-utils` | Uses dynamic `require()` for package.json — needs `import.meta` |
| 2 | `config` | `root-utils` | nconf wrapper |
| 3 | `version` | `root-utils` | Version detection |
| 4 | `validator` | `errors`, `tpl` | Validation utilities |
| 5 | `jest-snapshot` | `errors` | Test utility |
| 6 | `elasticsearch` | `debug` | ES client wrapper |
| 7 | `bookshelf-collision` | `errors` | Bookshelf plugin |
| 8 | `bookshelf-eager-load` | `debug` | Bookshelf plugin |
| 9 | `bookshelf-has-posts` | `debug` | Bookshelf plugin |
| 10 | `bookshelf-include-count` | `debug` | Bookshelf plugin |
| 11 | `bookshelf-filter` | `debug`, `errors`, `tpl` | Bookshelf plugin |
| 12 | `bookshelf-pagination` | `errors`, `tpl` | Bookshelf plugin |

### Wave 3 — Level 2 Dependencies — 10 packages

| # | Package | Internal deps | Notes |
|---|---------|--------------|-------|
| 1 | `nodemailer` | `errors` | Email transport |
| 2 | `zip` | `errors` | Archive utilities |
| 3 | `domain-events` | *(logging is devDep only)* | Delete hand-written `.d.ts` |
| 4 | `parse-email-address` | *(check deps)* | Email parsing |
| 5 | `request` | `errors`, `validator`, `version` | HTTP client |
| 6 | `http-stream` | `errors`, `request` | Streaming HTTP |
| 7 | `mw-error-handler` | `debug`, `errors`, `http-cache-utils`, `tpl` | Express error middleware |
| 8 | `express-test` | `jest-snapshot` | Test framework |
| 9 | `job-manager` | `errors`, `logging` | Bree-based job scheduler |
| 10 | `api-framework` | `debug`, `errors`, `promise`, `tpl`, `validator` | Largest package (16 files) |

### Wave 4 — Level 3+ Dependencies — 4 packages

| # | Package | Internal deps | Notes |
|---|---------|--------------|-------|
| 1 | `logging` | `elasticsearch`, `http-stream`, `pretty-stream`, `root-utils` | Core infrastructure |
| 2 | `metrics` | `elasticsearch`, `pretty-stream`, `root-utils` | Metrics collection |
| 3 | `server` | `debug`, `logging` | Server bootstrap |
| 4 | `bookshelf-plugins` | *all 10 bookshelf packages* | Aggregator — convert last |

---

## Dependency Graph

```
Wave 1 — Leaves (15 packages, no internal deps):
  bookshelf-custom-query, bookshelf-order, bookshelf-search,
  bookshelf-transaction-events, database-info, email-mock-receiver,
  http-cache-utils, mw-vhost, pretty-cli, pretty-stream, promise,
  root-utils, security, tpl, webhook-mock-receiver

Wave 2 — Level 1 (12 packages):
  bookshelf-collision → errors
  bookshelf-eager-load → debug
  bookshelf-filter → debug, errors, tpl
  bookshelf-has-posts → debug
  bookshelf-include-count → debug
  bookshelf-pagination → errors, tpl
  config → root-utils
  debug → root-utils
  elasticsearch → debug
  jest-snapshot → errors
  validator → errors, tpl
  version → root-utils

Wave 3 — Level 2 (10 packages):
  api-framework → debug, errors, promise, tpl, validator
  domain-events → (logging is devDep only)
  express-test → jest-snapshot
  http-stream → errors, request
  job-manager → errors, logging
  mw-error-handler → debug, errors, http-cache-utils, tpl
  nodemailer → errors
  parse-email-address → (check)
  request → errors, validator, version
  zip → errors

Wave 4 — Level 3+ (4 packages):
  bookshelf-plugins → all 10 bookshelf packages
  logging → elasticsearch, http-stream, pretty-stream, root-utils
  metrics → elasticsearch, pretty-stream, root-utils
  server → debug, logging
```

---

## Updating Existing TypeScript Packages

### `errors` package

Currently uses esbuild+tsc with dual CJS/ESM output (`cjs/`, `es/`, `types/` dirs). Since we're going ESM-only:

1. Remove esbuild dependency and `build:cjs`/`build:es` scripts
2. Switch to tsc-only build outputting to `build/`
3. Add `"type": "module"` to package.json
4. Update `main` from `cjs/index.js` to `build/index.js`
5. Remove `module` field (no longer needed — ESM is the default)
6. Update `exports` and `types` fields
7. Delete `cjs/`, `es/`, `types/` output directories
8. tsconfig already extends shared — will pick up new settings automatically
9. Ensure source uses `import type` where needed (`verbatimModuleSyntax`)

### `prometheus-metrics` package

Currently has a standalone tsconfig (doesn't extend shared):

1. Update tsconfig to extend `../tsconfig.json`, only override `rootDir`, `outDir`, `incremental`
2. Add `"type": "module"` to package.json
3. Update source to use `import type` where needed
4. Verify `.js` extensions on relative imports

---

## Ghost Compatibility

Ghost core (`ghost/core/package.json`) requires Node `^22.13.1` and is CJS (no `"type": "module"`).

Node 22.12+ unflagged `require()` of ES modules ([Node.js docs](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require)). This means Ghost's existing `require('@tryghost/*')` calls will continue to work with ESM packages — no changes needed in Ghost.

**Constraints:**
- Framework packages must not use top-level `await` (CJS `require()` cannot load modules with top-level await)
- This is unlikely to be an issue since none of the packages need top-level await

---

## Notes

- **No circular dependencies** exist in the package graph — clean topological order.
- **Vitest handles `.test.ts` ESM** natively — no additional config needed for test files.
- **`build/` is already in the root `.gitignore`** — no per-package gitignore changes needed.
- **`tsconfig.tsbuildinfo` is already in the root `.gitignore`** — incremental builds won't pollute git.
- **Packages that use lodash** (tpl, pretty-stream, bookshelf-pagination, etc.) can be converted to TS independently of the Lodash removal migration. Both migrations can proceed in parallel on different packages.
- **JSON imports** use `with { type: 'json' }` syntax (import attributes), supported in Node 22+.
- **No top-level await** — Ghost requires this since it `require()`s framework packages from CJS.
