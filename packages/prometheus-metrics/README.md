# Metrics Server

A standalone server for exporting prometheus metrics from Ghost

## Purpose

Prometheus metrics integration for exposing Ghost runtime counters, gauges, and histograms.

## Usage

Import the metrics client from the package root:

```ts
import { PrometheusClient } from '@tryghost/prometheus-metrics';
```

The standalone server is available separately:

```ts
import { MetricsServer } from '@tryghost/prometheus-metrics/server';
```

Install Express 4 or 5 in your application when using `MetricsServer`. Express is
an optional peer dependency and is not loaded by the package root.

## Develop

This is a monorepo package.

Follow the instructions for the top-level repo.

1. `git clone` this repo & `cd` into it as usual
2. Run `pnpm install` to install top-level dependencies.

## Test

- `pnpm lint` runs oxlint
- `pnpm test` runs lint and tests
