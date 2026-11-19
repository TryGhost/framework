import GhostMetricsClass = require('./GhostMetrics');

/**
 * Side-effect free entry point: importing it builds no metrics instance and
 * reads no `loggingrc`.
 */
declare const factory: {
    GhostMetrics: typeof GhostMetricsClass;
    /**
     * The process-wide (per-thread) metrics instance, or `undefined` if none
     * has been built or registered yet. Builds nothing.
     */
    getInstance(): GhostMetricsClass | undefined;
    /**
     * Make `instance` the process-wide (per-thread) metrics instance returned
     * by `require('@tryghost/metrics')`. Returns the instance.
     *
     * Throws if a different instance already exists; calling it again with the
     * same instance is a no-op.
     */
    setInstance<T extends GhostMetricsClass>(instance: T): T;
};

declare namespace factory {
    export type GhostMetrics = GhostMetricsClass;
    export type ElasticsearchOptions = GhostMetricsClass.ElasticsearchOptions;
    export type MetricsOptions = GhostMetricsClass.MetricsOptions;
    export type MetricOptions = GhostMetricsClass.MetricOptions;
    export type BatchOptions = GhostMetricsClass.BatchOptions;
    export type ResolvedBatchOptions = GhostMetricsClass.ResolvedBatchOptions;
    export type GhostMetricsOptions = GhostMetricsClass.GhostMetricsOptions;
    export type MetricShipper = GhostMetricsClass.MetricShipper;
}

export = factory;
