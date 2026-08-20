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
