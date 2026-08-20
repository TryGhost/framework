const jsonStringifySafe = require('json-stringify-safe');

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

            for (const [name, rate] of Object.entries(options.metrics.sampleRates || {})) {
                this.sampleRates[name] = normalizeSampleRate(rate, `metrics.sampleRates.${name}`);
            }
        } else {
            this.transports = [];
            this.metadata = {};
            this.sampleRate = 1;
        }

        // CASE: special env variable to enable long mode and level info
        if (process.env.LOIN) {
            this.mode = 'long';
        }

        this.shippers = {};

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

        this.shippers.elasticsearch = (name, value, sampleRate) => {
            if (typeof value !== 'object') {
                value = { value };
            }

            if (!('@timestamp' in value)) {
                value['@timestamp'] = Date.now();
            }

            if (this.metadata) {
                value.metadata = this.metadata;
            }

            // Sampled documents carry their rate so consumers can scale counts back up.
            // An absent sampleRate means the metric was not sampled (i.e. a rate of 1).
            if (sampleRate < 1) {
                value.sampleRate = sampleRate;
            }

            return elasticSearch.index(value, `metrics-${name}`);
        };
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
