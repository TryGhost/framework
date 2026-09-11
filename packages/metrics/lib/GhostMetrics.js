const jsonStringifySafe = require('json-stringify-safe');
const MetricsBatch = require('./MetricsBatch');

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_BATCH_MAX_WAIT_MS = 5000;
// Ten batches' worth of headroom before the buffer starts shedding load
const DEFAULT_BATCH_BUFFER_FACTOR = 10;

/**
 * @description Check a value is usable as a sample rate: a number between 0 and 1 inclusive
 * @param {any} rate Candidate sample rate
 * @returns {boolean}
 */
function isValidSampleRate(rate) {
    return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1;
}

/**
 * @description Validate a configured sample rate, defaulting to 1 (ship everything) when unset
 * @param {any} rate Candidate sample rate
 * @param {string} key Config key used in the error message
 * @returns {number}
 */
function normalizeSampleRate(rate, key) {
    if (rate === undefined || rate === null) {
        return 1;
    }

    if (!isValidSampleRate(rate)) {
        throw new Error(`${key} must be a number between 0 and 1, got ${jsonStringifySafe(rate)}`);
    }

    return rate;
}

/**
 * @description Validate a batching config value that must be a positive whole number
 * @param {any} value Candidate value
 * @param {number} fallback Value to use when unset
 * @param {string} key Config key used in the error message
 * @returns {number}
 */
function normalizePositiveInteger(value, fallback, key) {
    if (value === undefined || value === null) {
        return fallback;
    }

    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
        throw new Error(`${key} must be a positive whole number, got ${jsonStringifySafe(value)}`);
    }

    return value;
}

/**
 * @description Validate the batching config, returning null when batching is off
 * @param {any} batch Candidate batch config: absent/false for off, true or a property bag for on
 * @returns {{size: number, maxWaitMs: number, maxBufferSize: number} | null}
 */
function normalizeBatch(batch) {
    if (batch === undefined || batch === null || batch === false) {
        return null;
    }

    if (batch === true) {
        batch = {};
    }

    if (typeof batch !== 'object' || Array.isArray(batch)) {
        throw new Error(
            `metrics.batch must be a boolean or an object, got ${jsonStringifySafe(batch)}`,
        );
    }

    // `enabled` lets a deployment turn batching off without discarding the rest
    // of the config, which matters when it is layered from config files
    if ('enabled' in batch && typeof batch.enabled !== 'boolean') {
        throw new Error(
            `metrics.batch.enabled must be a boolean, got ${jsonStringifySafe(batch.enabled)}`,
        );
    }

    if (batch.enabled === false) {
        return null;
    }

    const size = normalizePositiveInteger(batch.size, DEFAULT_BATCH_SIZE, 'metrics.batch.size');
    const maxWaitMs = normalizePositiveInteger(
        batch.maxWaitMs,
        DEFAULT_BATCH_MAX_WAIT_MS,
        'metrics.batch.maxWaitMs',
    );
    const maxBufferSize = normalizePositiveInteger(
        batch.maxBufferSize,
        size * DEFAULT_BATCH_BUFFER_FACTOR,
        'metrics.batch.maxBufferSize',
    );

    if (maxBufferSize < size) {
        throw new Error(
            `metrics.batch.maxBufferSize must be at least metrics.batch.size (${size}), got ${maxBufferSize}`,
        );
    }

    return { size, maxWaitMs, maxBufferSize };
}

/**
 * @description Clone structured metric data without allowing unusual values
 * to make instrumentation throw.
 * @param {any} value Value to clone
 * @returns {any}
 */
function cloneMetricValueFallback(value, seen = new WeakMap()) {
    if (typeof value !== 'object' || value === null) {
        return value;
    }

    if (seen.has(value)) {
        return seen.get(value);
    }

    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        return value;
    }

    const clone = Array.isArray(value) ? [] : Object.create(prototype);
    seen.set(value, clone);

    for (const [key, nestedValue] of Object.entries(value)) {
        clone[key] = cloneMetricValueFallback(nestedValue, seen);
    }

    return clone;
}

function cloneMetricValue(value) {
    if (typeof value !== 'object' || value === null) {
        return value;
    }

    try {
        return structuredClone(value);
    } catch {
        // Keep instrumentation from throwing for unusual non-cloneable values.
        return cloneMetricValueFallback(value);
    }
}

/**
 * @description Build the document shipped for a metric value
 * The value is copied rather than mutated, so a batched document can't be
 * changed by the caller after it has been buffered.
 * @param {any} value Value of the metric
 * @param {object} metadata Metadata to ship alongside the value
 * @param {number} sampleRate Rate the metric survived
 * @returns {object}
 */
function buildDocument(value, metadata, sampleRate) {
    // Metrics are expected to be structured data. Clone them synchronously so
    // callers can safely reuse or mutate nested values after `metric()` returns.
    const clonedValue = cloneMetricValue(value);
    const document =
        typeof clonedValue === 'object' && clonedValue !== null && !Array.isArray(clonedValue)
            ? clonedValue
            : { value: clonedValue };

    if (!('@timestamp' in document)) {
        document['@timestamp'] = Date.now();
    }

    if (metadata) {
        document.metadata = cloneMetricValue(metadata);
    }

    // Sampled documents carry their rate so consumers can scale counts back up.
    // An absent sampleRate means the metric was not sampled (i.e. a rate of 1).
    if (sampleRate < 1) {
        document.sampleRate = sampleRate;
    }

    return document;
}

/**
 * @description Metric shipper class built on the loggingrc config used in Ghost projects
 */
class GhostMetrics {
    /**
     * Properties in the options bag:
     *
     * domain:             Metadata for metrics in shared databases.
     * mode:               Is used to print short or long log - used for stdout shipper.
     * metrics.transports:  An array of transports for metric shipping (e.g. ['stdout', 'elasticsearch'])
     * metrics.metadata:    A property bag of metadata values to be shipped alongside the metric value
     * metrics.sampleRate:  Default proportion of metrics to ship, between 0 and 1 (defaults to 1, ship everything)
     * metrics.sampleRates: Per-metric sample rate overrides, keyed by metric name
     * metrics.batch:       Batch shipping config for network transports; absent or false to ship one metric per request
     * elasticsearch:       Elasticsearch transport configuration
     * @param {object} options Bag of options
     */
    constructor(options) {
        options = options || {};

        this.domain = options.domain || 'localhost';
        this.elasticsearch = options.elasticsearch || {};
        this.mode = process.env.MODE || options.mode || 'short';
        // Prototype-free so that metric names like "__proto__" are stored and read back
        // as ordinary keys, and inherited properties are never mistaken for configured rates
        this.sampleRates = Object.create(null);
        if (options.metrics !== null && typeof options.metrics === 'object') {
            this.transports = options.metrics.transports || [];
            this.metadata = options.metrics.metadata || {};
            this.sampleRate = normalizeSampleRate(options.metrics.sampleRate, 'metrics.sampleRate');
            this.batch = normalizeBatch(options.metrics.batch);

            for (const [name, rate] of Object.entries(options.metrics.sampleRates || {})) {
                this.sampleRates[name] = normalizeSampleRate(rate, `metrics.sampleRates.${name}`);
            }
        } else {
            this.transports = [];
            this.metadata = {};
            this.sampleRate = 1;
            this.batch = null;
        }

        // CASE: special env variable to enable long mode and level info
        if (process.env.LOIN) {
            this.mode = 'long';
        }

        this.shippers = {};
        // Populated by transports that buffer, so `flush()` can drain them
        this.batches = [];

        this.transports.forEach((transport) => {
            let transportFn = `setup${transport[0].toUpperCase()}${transport.substr(1)}Shipper`;

            if (!this[transportFn]) {
                throw new Error(`${transport} is an invalid transport`);
            }

            this[transportFn]();
        });
    }

    /**
     * @description Setup stdout stream.
     */
    setupStdoutShipper() {
        const GhostPrettyStream = require('@tryghost/pretty-stream');
        const prettyStdOut = new GhostPrettyStream({
            mode: this.mode,
        });

        prettyStdOut.pipe(process.stdout);

        this.shippers.stdout = (name, value, sampleRate) => {
            // Only mention the sample rate when the metric is actually sampled, so unsampled output is unchanged
            const suffix = sampleRate < 1 ? ` (sample rate: ${sampleRate})` : '';

            prettyStdOut.write({
                msg: `Metric ${name}: ${jsonStringifySafe(value)}${suffix}`,
                level: 30, // Magic number, log level for info
            });

            return Promise.resolve();
        };
    }

    /**
     * @description Setup ElasticSearch metric shipper
     * ElasticSearch metrics are shipped to an index individually for each metric.
     * The name of the index is the name of the metric prefixed with "metrics-", the metric name itself should be sluggified
     */
    setupElasticsearchShipper() {
        const ElasticSearch = require('@tryghost/elasticsearch');

        const elasticSearch = new ElasticSearch({
            node: this.elasticsearch.host,
            auth: {
                username: this.elasticsearch.username,
                password: this.elasticsearch.password,
            },
            requestTimeout: 5000,
            proxy: 'proxy' in this.elasticsearch ? this.elasticsearch.proxy : null,
        });

        if (!this.batch) {
            this.shippers.elasticsearch = (name, value, sampleRate) => {
                return elasticSearch.index(
                    buildDocument(value, this.metadata, sampleRate),
                    `metrics-${name}`,
                );
            };

            return;
        }

        // Batched metrics are shipped with the bulk API, so a hot code path
        // costs one request per batch instead of one per metric. Documents for
        // different metric names can share a batch because each operation
        // carries its own index.
        const batch = new MetricsBatch({
            ...this.batch,
            ship: (operations) => elasticSearch.bulk(operations),
        });

        this.batches.push(batch);

        this.shippers.elasticsearch = (name, value, sampleRate) => {
            batch.add({
                index: `metrics-${name}`,
                document: buildDocument(value, this.metadata, sampleRate),
            });

            // Resolves once the metric is buffered, not once it is shipped
            return Promise.resolve();
        };
    }

    /**
     * @description Ship anything buffered by batching transports
     * A no-op when batching is off, so callers (e.g. a shutdown handler) can
     * always call it without knowing how the instance is configured.
     * @returns {Promise<void>}
     */
    async flush() {
        await Promise.allSettled(this.batches.map((batch) => batch.flush()));
    }

    /**
     * @description Resolve the sample rate for a metric, most specific config first
     * Invalid per-call overrides are ignored rather than thrown, so a bad call site cannot
     * take down the code path it is measuring. Invalid config throws at construction time.
     * @param {string} name Name of the metric
     * @param {object} [options] Per-call options bag
     * @returns {number}
     */
    getSampleRate(name, options) {
        if (options && isValidSampleRate(options.sampleRate)) {
            return options.sampleRate;
        }

        if (isValidSampleRate(this.sampleRates[name])) {
            return this.sampleRates[name];
        }

        return this.sampleRate;
    }

    /**
     * @description Metric shipper function
     * @param {string} name Name of the metric, should be slugified for increased back-end compatibility (e.g. "memory-usage")
     * @param {any} value Value of metric, will be co-erced to an object before being shipped
     * @param {object} [options] Per-call options bag
     * @param {number} [options.sampleRate] Proportion of calls to ship, between 0 and 1, overriding any configured rate
     */
    metric(name, value, options) {
        const sampleRate = this.getSampleRate(name, options);

        // A rate of 1 short-circuits, so unsampled metrics do no extra work
        if (sampleRate < 1 && Math.random() >= sampleRate) {
            return Promise.resolve(null);
        }

        const promises = [];
        for (const metricShipper of Object.values(this.shippers)) {
            promises.push(metricShipper(name, value, sampleRate));
        }

        return Promise.allSettled(promises).then(() => null);
    }
}

module.exports = GhostMetrics;
