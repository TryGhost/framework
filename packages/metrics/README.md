# Metrics

## Install

`npm install @tryghost/metrics --save`

or

`pnpm add @tryghost/metrics`

## Purpose

Ghost metrics facade for collecting and emitting operational metrics across services.

## Usage

The default export is a pre-configured `GhostMetrics` instance, built from the
`loggingrc` file at the process root if one exists. The `GhostMetrics` class is
attached to it for creating additional instances.

```js
const metrics = require('@tryghost/metrics');

await metrics.metric('memory-usage', process.memoryUsage().heapUsed);

const custom = new metrics.GhostMetrics({
    domain: 'my-service',
    metrics: { transports: ['stdout'] },
});
```

### Building your own instance

`@tryghost/metrics/factory` is a side-effect free entry point for applications
that build their metrics instance themselves. Importing it constructs nothing
and reads no `loggingrc`:

```js
const { createMetrics, setInstance, GhostMetrics } = require('@tryghost/metrics/factory');

const metrics = createMetrics({
    domain: 'my-service',
    metrics: { transports: ['stdout'] },
});
setInstance(metrics);

// From here on, every require of the main entry returns `metrics`
require('@tryghost/metrics') === metrics; // true
```

- `createMetrics(options)` returns `new GhostMetrics(options)`. It uses only
  the options passed in and registers nothing.
- `setInstance(instance)` makes `instance` the one the main entry returns and
  returns it. Call it before anything requires `@tryghost/metrics`: if a
  different instance already exists (set earlier, or built by the main entry)
  it throws instead of silently leaving two instances in the process. Calling
  it again with the same instance is a no-op.
- The registered instance is stored on `globalThis` under
  `Symbol.for('@tryghost/metrics@<major>')`, so every copy of the same major
  in the `node_modules` tree returns it. `globalThis` is per thread: a worker
  thread does not see an instance set on the main thread.
- Without `setInstance()` nothing changes: each copy of the package builds its
  own instance from `loggingrc` on first require.
- The main entry attaches `GhostMetrics` to whichever instance it returns,
  including one registered with `setInstance()`.

The package has no `exports` map, so ES modules must import the file by name:
`import factory from '@tryghost/metrics/factory.js'`.

### Elasticsearch client implementation

`elasticsearch.implementation` picks how the Elasticsearch transport talks to
the cluster. `legacy` (the default) uses the official `@elastic/elasticsearch`
client; `fetch` uses Node's built-in `fetch`. The `fetch` implementation will
become the only one in the next major version.

`elasticsearch.proxy` only works with `legacy`. With `fetch`, it's ignored with
a warning: set `HTTP_PROXY` or `HTTPS_PROXY` to match the Elasticsearch URL's
scheme (and `NO_PROXY` as needed), and enable them with `NODE_USE_ENV_PROXY=1`
or `--use-env-proxy`. This needs Node 22.21.0+ on the 22.x line, or Node 24+,
and applies to every request the process makes.

### Sampling

High-volume metrics can be sampled so only a proportion of them are shipped.
`sampleRate` is a number between 0 and 1, and defaults to `1` (ship
everything). Configure a default rate, per-metric rates, or both:

```js
const metrics = require('@tryghost/metrics');

const sampled = new metrics.GhostMetrics({
    metrics: {
        transports: ['elasticsearch'],
        sampleRate: 0.5,
        sampleRates: {
            'request-duration': 0.01,
        },
    },
});
```

A rate can also be overridden per call, which takes precedence over both:

```js
await sampled.metric('request-duration', duration, { sampleRate: 0.001 });
```

Sampled metrics carry the rate they survived, so consumers can scale counts
back up by dividing by it. The Elasticsearch shipper writes it as a
`sampleRate` field, and the stdout shipper appends it to the log line. Metrics
shipped at a rate of `1` are not tagged, so an absent `sampleRate` means the
metric was not sampled.

An invalid configured rate throws when the instance is constructed. An invalid
per-call rate is ignored in favour of the configured rate, so a bad call site
cannot break the code path it is measuring.

### Batching

Sampling reduces how many metrics are shipped; batching reduces how many
requests they take. With batching on, the Elasticsearch transport buffers
documents and ships them with the bulk API, so a hot code path costs one
request per batch instead of one per metric. It is off by default:

```js
const metrics = require('@tryghost/metrics');

const batched = new metrics.GhostMetrics({
    metrics: {
        transports: ['elasticsearch'],
        batch: true,
    },
});
```

`batch: true` uses the defaults; pass an object to override them:

| Option          | Default     | Meaning                                                         |
| --------------- | ----------- | --------------------------------------------------------------- |
| `enabled`       | `true`      | Set to `false` to turn batching off without dropping the config |
| `size`          | `100`       | Buffered documents that trigger a bulk request                  |
| `maxWaitMs`     | `5000`      | How long a document may sit in the buffer before it is shipped  |
| `maxBufferSize` | `size * 10` | Hard cap on buffered documents; further metrics are dropped     |

```js
const batched = new metrics.GhostMetrics({
    metrics: {
        transports: ['elasticsearch'],
        batch: {
            size: 500,
            maxWaitMs: 2000,
        },
    },
});
```

Documents for different metric names can share a batch, because each bulk
operation carries its own index. Sampling still applies first, so only metrics
that survive their sample rate are buffered.

Batching changes two things worth knowing about:

- `metric()` resolves once the metric is **buffered**, not once it has been
  shipped. It was already fire-and-forget for most callers, but a caller that
  awaited delivery no longer gets it.
- Buffered metrics are lost if the process exits without draining them. Call
  `flush()` from your shutdown handler; it is a no-op when batching is off, so
  it is always safe to call.

```js
process.on('SIGTERM', async () => {
    await batched.flush();
    process.exit(0);
});
```

The buffer is bounded: once it holds `maxBufferSize` documents, further metrics
are dropped rather than growing the heap while Elasticsearch is slow or down.
Only one bulk request is ever in flight, and a failed batch is dropped without
rejecting, so a metric call can never break the code path it is measuring.

Invalid batch config throws when the instance is constructed.

The stdout transport is unaffected - it writes locally, so there is nothing to
batch.

### Types

Types ship with the package. `GhostMetrics` is exported as both a value (the
class) and a type (an instance of it), alongside the options and shipper types:

```ts
import metrics, { GhostMetrics } from '@tryghost/metrics';
import type {
    GhostMetrics as GhostMetricsInstance,
    GhostMetricsOptions,
    MetricsOptions,
    MetricOptions,
    BatchOptions,
    ElasticsearchOptions,
    MetricShipper,
} from '@tryghost/metrics';

const options: GhostMetricsOptions = { domain: 'my-service' };
const custom: GhostMetricsInstance = new GhostMetrics(options);

function ship(instance: GhostMetricsInstance, name: string, value: unknown) {
    return instance.metric(name, value);
}
```

In a CommonJS file the whole surface is reachable through a single import:

```ts
import metrics = require('@tryghost/metrics');

const custom: metrics.GhostMetrics = new metrics.GhostMetrics({ domain: 'my-service' });
const options: metrics.GhostMetricsOptions = {};
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
