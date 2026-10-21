# Security

Security helper primitives used by Ghost services.

## Install

`npm install @tryghost/security --save`

or

`pnpm add @tryghost/security`

## Purpose

`@tryghost/security` provides focused helpers for secure token generation and validation, password hashing, URL-safe encoding, and identifier/string normalization.

## Usage

```js
const security = require('@tryghost/security');

const secret = security.secret.create('content');
const hash = await security.password.hash('super-secret');
const isMatch = await security.password.compare('super-secret', hash);
```

## API

- `security.password`: password hashing and comparison helpers (`hash`, `compare`).
- `security.secret`: secure random secret generation (`create`).
- `security.tokens`: token generation and reset token helpers.
- `security.url`: base64 URL-safe encode/decode helpers.
- `security.string`: safe slug-style string normalization.
- `security.identifier`: legacy identifier helper (`uid`, deprecated).

### Password reset tokens

`security.tokens.resetToken.generateHash()` and `compare()` require a
`passwordHash` option containing the user's existing stored password hash.
Do not pass a plaintext password. The stored hash invalidates reset tokens
after a password change; these helpers do not hash passwords for storage.

```js
const token = security.tokens.resetToken.generateHash({
    expires,
    email,
    dbHash,
    passwordHash: storedPasswordHash,
});

const result = security.tokens.resetToken.compare({
    token,
    dbHash,
    passwordHash: storedPasswordHash,
});
```

This option was renamed from `password` to `passwordHash`. Callers must update
both methods when upgrading. The token format is unchanged, so existing reset
tokens remain valid with the same stored hash, site secret, and expiry.

## Development

Source lives in `index.ts` and `lib/*.ts`. `pnpm build` emits CommonJS JavaScript
and declarations alongside the sources; only compiled files are published.

Run `pnpm test` for the build, type checks, runtime tests, coverage, and lint.

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
