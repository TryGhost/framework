# Elasticsearch

## Install

`npm install @tryghost/elasticsearch --save`

or

`pnpm add @tryghost/elasticsearch`

## Purpose

Elasticsearch client wrapper plus Bunyan stream integration used by Ghost logging/metrics flows.

## Usage

```js
const ElasticSearch = require('@tryghost/elasticsearch');

const es = new ElasticSearch({
    node: 'https://elasticsearch.example.com:9200',
    auth: { username: 'elastic', password: 'secret' },
    requestTimeout: 5000, // per attempt, default 30000
    maxRetries: 3, // default 3
});

await es.index({ message: 'hello' }, 'my-index');
await es.bulk([{ index: 'my-index', document: { message: 'hello' } }]);
```

`ElasticSearch.BunyanStream` wraps the client in a writable stream for Bunyan
that batches logs into bulk requests, shipping every 5 MB or 30 seconds, and
`flush()` ships whatever is buffered on shutdown.

Requests use Node's built-in `fetch` and are best-effort: failures are
reported via `debug` and never thrown. Network errors and 408/429/5xx
responses are retried with backoff. To send requests through a proxy, set
`HTTPS_PROXY` and `NODE_USE_ENV_PROXY=1`.

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
