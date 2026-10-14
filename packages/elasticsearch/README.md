# Elasticsearch

## Install

`npm install @tryghost/elasticsearch --save`

or

`pnpm add @tryghost/elasticsearch`

## Purpose

Elasticsearch client wrapper used by Ghost metrics.

## Usage

```js
const ElasticSearch = require('@tryghost/elasticsearch');

const es = new ElasticSearch({
    implementation: 'fetch', // or 'legacy' (default)
    node: 'https://elasticsearch.example.com:9200',
    auth: { username: 'elastic', password: 'secret' },
    requestTimeout: 5000,
});

await es.index({ message: 'hello' }, 'my-index');
await es.bulk([{ index: 'my-index', document: { message: 'hello' } }]);
```

### Implementations

Pass `implementation` in the client config to choose how requests are sent:

- `legacy` (default): the official `@elastic/elasticsearch` client. Supports
  the client's options, such as `proxy`.
- `fetch`: Node's built-in `fetch`. Supports `node`, `auth`, `requestTimeout`
  (per attempt, default 30000) and `maxRetries` (default 3). Network errors and
  408/429/5xx responses are retried with backoff. To send requests through a
  proxy, set `HTTP_PROXY` or `HTTPS_PROXY` (matching the node URL's scheme) and
  `NODE_USE_ENV_PROXY=1`, which needs Node 22.21.0+ or 24+.

The legacy client is only loaded when it's selected. Both implementations are
best-effort: failures are reported via `debug` and never thrown. `fetch` will
become the only implementation in the next major version.

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
