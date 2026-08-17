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

### Types

Types ship with the package. `GhostMetrics` is exported as both a value (the
class) and a type (an instance of it), alongside the options and shipper types:

```ts
import metrics, { GhostMetrics } from '@tryghost/metrics';
import type {
    GhostMetrics as GhostMetricsInstance,
    GhostMetricsOptions,
    MetricsOptions,
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
