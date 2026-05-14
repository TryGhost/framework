# Errors

## Install

`npm install @tryghost/errors --save`

or

`pnpm add @tryghost/errors`

## Purpose

Shared Ghost error classes and utilities for typed errors, context propagation, and safe stack formatting.

## Usage

Ghost errors separate human-readable messages from machine-readable codes and structured metadata.

```js
const errors = require('@tryghost/errors');

throw new errors.UnsupportedMediaTypeError({
    message: 'Theme entry exceeds maximum uncompressed size.',
    context: 'The zip contains an entry that exceeds the configured limit.',
    code: 'ENTRY_TOO_LARGE',
    errorDetails: {
        entryName,
        observedBytes,
        limitBytes,
    },
});
```

### Field guide

| Field          | Purpose                                   | Use for                                                                                |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `message`      | Human-readable summary of what went wrong | Primary error text shown/logged by Ghost                                               |
| `context`      | Human-readable supporting context         | A sentence or phrase that explains where/why the error happened                        |
| `code`         | Machine-readable reason                   | UPPER_SNAKE_CASE values such as `INVALID_JWT`, `ENTRY_TOO_LARGE`, `TOKEN_EXPIRED`      |
| `errorDetails` | Structured metadata                       | Objects/arrays/numbers needed for logs, Sentry extra data, debugging, or API consumers |
| `help`         | Human-readable remediation guidance       | Instructions for how to fix or recover from the error                                  |
| `err`          | Wrapped underlying error                  | Preserving details from a lower-level exception                                        |

### Common mistakes

Do not put structured metadata in `context`. `context` should be a string.

```js
// Bad
throw new errors.UnsupportedMediaTypeError({
    message: 'Theme entry exceeds maximum uncompressed size.',
    context: {
        reason: 'entry_too_large',
        observedBytes,
        limitBytes,
    },
});

// Good
throw new errors.UnsupportedMediaTypeError({
    message: 'Theme entry exceeds maximum uncompressed size.',
    context: 'The zip contains an entry that exceeds the configured limit.',
    code: 'ENTRY_TOO_LARGE',
    errorDetails: {
        observedBytes,
        limitBytes,
    },
});
```

Do not use lowercase strings like `entry_too_large` as `context`. Use an UPPER_SNAKE_CASE `code` for programmatic handling and keep `context` human-readable.

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
