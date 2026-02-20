# Security

Security helper primitives used by Ghost services.

## Install

`npm install @tryghost/security --save`

or

`yarn add @tryghost/security`

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

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](LICENSE).
