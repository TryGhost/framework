import GhostMetrics = require('./GhostMetrics');

/**
 * A pre-configured `GhostMetrics` instance (built from `loggingrc` if present),
 * with the `GhostMetrics` class attached for creating additional instances.
 */
declare const metrics: GhostMetrics & {
    GhostMetrics: typeof GhostMetrics;
};

declare namespace metrics {
    export type ElasticsearchOptions = GhostMetrics.ElasticsearchOptions;
    export type MetricsOptions = GhostMetrics.MetricsOptions;
    export type GhostMetricsOptions = GhostMetrics.GhostMetricsOptions;
    export type MetricShipper = GhostMetrics.MetricShipper;
}

export = metrics;
