import MetricsBatch = require('./MetricsBatch');

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
 * Batch shipping configuration for network transports.
 */
interface BatchOptions {
    /** Set to `false` to turn batching off while keeping the rest of the config. @default true */
    enabled?: boolean;
    /** Buffered documents that trigger a bulk request. @default 100 */
    size?: number;
    /** How long a document may sit in the buffer before it is shipped, in milliseconds. @default 5000 */
    maxWaitMs?: number;
    /** Hard cap on buffered documents; further metrics are dropped. @default `size * 10` */
    maxBufferSize?: number;
}

/**
 * Resolved batch configuration, with every value filled in.
 */
interface ResolvedBatchOptions {
    size: number;
    maxWaitMs: number;
    maxBufferSize: number;
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
    /**
     * Ship metrics in batches rather than one request per metric. `true` uses the defaults,
     * an object overrides them, absent or `false` keeps one request per metric. Throws at
     * construction time for values that aren't positive whole numbers.
     */
    batch?: boolean | BatchOptions;
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
    /** Resolved batch config, or `null` when batching is off. */
    batch: ResolvedBatchOptions | null;
    shippers: Record<string, MetricShipper>;
    /** Buffers belonging to batching transports, drained by {@link GhostMetrics.flush}. */
    batches: MetricsBatch[];

    constructor(options?: GhostMetricsOptions);

    /**
     * Setup stdout stream shipper.
     */
    setupStdoutShipper(): void;

    /**
     * Setup ElasticSearch metric shipper. Metrics are shipped to a per-metric
     * index named `metrics-<name>`; the metric name should be sluggified. With
     * batching on, documents are buffered and shipped with the bulk API.
     */
    setupElasticsearchShipper(): void;

    /**
     * Ship anything buffered by batching transports. A no-op when batching is off.
     */
    flush(): Promise<void>;

    /**
     * Resolve the sample rate for a metric: per-call override, then per-metric config,
     * then the instance default.
     */
    getSampleRate(name: string, options?: MetricOptions): number;

    /**
     * Ship a metric through every configured transport, unless it is dropped by sampling.
     * With batching on, the returned promise resolves once the metric is buffered rather
     * than once it has been shipped.
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
        BatchOptions,
        ResolvedBatchOptions,
        GhostMetricsOptions,
        MetricShipper,
    };
}

export = GhostMetrics;
