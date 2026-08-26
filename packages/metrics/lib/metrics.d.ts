import GhostMetricsClass = require('./GhostMetrics');

/**
 * A pre-configured `GhostMetrics` instance (built from `loggingrc` if present),
 * with the `GhostMetrics` class attached for creating additional instances.
 */
declare const metrics: GhostMetricsClass & {
    GhostMetrics: typeof GhostMetricsClass;
};

declare namespace metrics {
    /**
     * Instance type of the `GhostMetrics` class, so consumers can annotate
     * values with `GhostMetrics` without reaching for `InstanceType<>`.
     */
    export type GhostMetrics = GhostMetricsClass;
    export type ElasticsearchOptions = GhostMetricsClass.ElasticsearchOptions;
    export type MetricsOptions = GhostMetricsClass.MetricsOptions;
    export type MetricOptions = GhostMetricsClass.MetricOptions;
    export type GhostMetricsOptions = GhostMetricsClass.GhostMetricsOptions;
    export type MetricShipper = GhostMetricsClass.MetricShipper;
}

export = metrics;
