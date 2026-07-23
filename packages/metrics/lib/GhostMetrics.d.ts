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
 * A single metric shipper function keyed by transport name.
 */
type MetricShipper = (name: string, value: unknown) => Promise<unknown>;

/**
 * Metric shipper class built on the loggingrc config used in Ghost projects.
 */
declare class GhostMetrics {
    domain: string;
    elasticsearch: ElasticsearchOptions;
    mode: string;
    transports: string[];
    metadata: Record<string, unknown>;
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
     * Ship a metric through every configured transport.
     * @param name Metric name, should be slugified for back-end compatibility (e.g. `"memory-usage"`).
     * @param value Metric value; coerced to an object before being shipped.
     */
    metric(name: string, value: unknown): Promise<null>;
}

declare namespace GhostMetrics {
    export { ElasticsearchOptions, MetricsOptions, GhostMetricsOptions, MetricShipper };
}

export = GhostMetrics;
