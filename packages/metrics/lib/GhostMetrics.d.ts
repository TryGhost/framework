/**
 * Elasticsearch transport configuration.
 */
interface ElasticsearchOptions {
    /** Elasticsearch node URL (maps to the client `node` option). */
    host?: string;
    /** Basic-auth username. */
    username?: string;
    /** Basic-auth password. */
    password?: string;
    /** Optional proxy URL; when absent no proxy is used. */
    proxy?: string;
}

/**
 * Metrics-specific configuration, piggy-backed on the logging config.
 */
interface MetricsOptions {
    /** Transports to ship metrics through (e.g. `['stdout', 'elasticsearch']`). */
    transports?: string[];
    /** Property bag of metadata values shipped alongside each metric value. */
    metadata?: Record<string, unknown>;
    /**
     * Default proportion of metrics to ship, between 0 and 1. Throws at construction
     * time if it is not a number in that range. @default 1
     */
    sampleRate?: number;
    /** Per-metric sample rate overrides, keyed by metric name. Same validation as `sampleRate`. */
    sampleRates?: Record<string, number>;
}

/**
 * Per-call options accepted by {@link GhostMetrics.metric}.
 */
interface MetricOptions {
    /**
     * Proportion of calls to ship, between 0 and 1, taking precedence over any configured
     * rate. Values outside that range are ignored rather than throwing.
     */
    sampleRate?: number;
}

/**
 * Options bag accepted by the {@link GhostMetrics} constructor.
 */
interface GhostMetricsOptions {
    /** Metadata for metrics in shared databases. @default 'localhost' */
    domain?: string;
    /** Print short or long log form for the stdout shipper. @default 'short' */
    mode?: string;
    /** Elasticsearch transport configuration. */
    elasticsearch?: ElasticsearchOptions;
    /** Metric transport/metadata configuration. */
    metrics?: MetricsOptions;
}

/**
 * A single metric shipper function keyed by transport name. Receives the sample rate the
 * metric survived, so transports can record it alongside the value.
 */
type MetricShipper = (name: string, value: unknown, sampleRate?: number) => Promise<unknown>;

/**
 * Metric shipper class built on the loggingrc config used in Ghost projects.
 */
declare class GhostMetrics {
    domain: string;
    elasticsearch: ElasticsearchOptions;
    mode: string;
    transports: string[];
    metadata: Record<string, unknown>;
    sampleRate: number;
    sampleRates: Record<string, number>;
    shippers: Record<string, MetricShipper>;

    constructor(options?: GhostMetricsOptions);

    /**
     * Setup stdout stream shipper.
     */
    setupStdoutShipper(): void;

    /**
     * Setup ElasticSearch metric shipper. Metrics are shipped to a per-metric
     * index named `metrics-<name>`; the metric name should be sluggified.
     */
    setupElasticsearchShipper(): void;

    /**
     * Resolve the sample rate for a metric: per-call override, then per-metric config,
     * then the instance default.
     */
    getSampleRate(name: string, options?: MetricOptions): number;

    /**
     * Ship a metric through every configured transport, unless it is dropped by sampling.
     * @param name Metric name, should be slugified for back-end compatibility (e.g. `"memory-usage"`).
     * @param value Metric value; coerced to an object before being shipped.
     * @param options Per-call options, e.g. a `sampleRate` override.
     */
    metric(name: string, value: unknown, options?: MetricOptions): Promise<null>;
}

declare namespace GhostMetrics {
    export {
        ElasticsearchOptions,
        MetricsOptions,
        MetricOptions,
        GhostMetricsOptions,
        MetricShipper,
    };
}

export = GhostMetrics;
