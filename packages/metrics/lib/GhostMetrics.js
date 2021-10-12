const jsonStringifySafe = require('json-stringify-safe');
const GhostPrettyStream = require('@tryghost/pretty-stream');

/**
 * @description Metric shipper class built on the loggingrc config used in Ghost projects
 */
class GhostMetrics {
    /**
     * Properties in the options bag:
     * 
     * domain:           Metadata for metrics in shared databases.
     * mode:             Is used to print short or long log - used for stdout shipper.
     * metricTransports: An array of transports for metric shipping (e.g. ['stdout', 'elasticsearch'])
     * elasticsearch:    Elasticsearch transport configuration
     * @param {object} options Bag of options
     */
    constructor(options) {
        options = options || {};

        this.domain = options.domain || 'localhost';
        this.transports = options.metricTransports || [];
        this.elasticsearch = options.elasticsearch || {};
        this.mode = process.env.MODE || options.mode || 'short';

        // CASE: special env variable to enable long mode and level info
        if (process.env.LOIN) {
            this.mode = 'long';
        }

        this.shippers = {};

        this.transports.forEach((transport) => {
            let transportFn = `setup${transport[0].toUpperCase()}${transport.substr(1)}Shipper`;

            if (!this[transportFn]) {
                throw new Error(`${transport} is an invalid transport`); // eslint-disable-line
            }

            this[transportFn]();
        });
    }

    /**
     * @description Setup stdout stream.
     */
    setupStdoutShipper() {
        const prettyStdOut = new GhostPrettyStream({
            mode: this.mode
        });

        prettyStdOut.pipe(process.stdout);

        this.shippers.stdout = (name, value) => {
            prettyStdOut.write({
                msg: `Metric ${name}: ${jsonStringifySafe(value)}`,
                level: 30 // Magic number, log level for info
            });
        };
    }

    /**
     * @description Setup ElasticSearch metric shipper
     */
    setupElasticsearchShipper() {
        const ElasticSearch = require('@tryghost/elasticsearch');

        const elasticSearch = new ElasticSearch({
            node: this.elasticsearch.host,
            auth: {
                username: this.elasticsearch.username,
                password: this.elasticsearch.password
            }
        });

        this.shippers.elasticsearch = (name, value) => {
            if (typeof value !== 'object') {
                value = {value};
            }

            value.domain = this.domain;

            elasticSearch.index(value, name);
        };
    }

    /**
     * @description Metric shipper function
     * @param {string} name Name of the metric, should be slugified for increased back-end compatibility (e.g. "memory-usage")
     * @param {any} value Value of metric, will be co-erced to an object before being shipped
     */
    metric(name, value) {
        for (const metricShipper of Object.values(this.shippers)) {
            metricShipper(name, value);
        }
    }
}

module.exports = GhostMetrics;
