const splitImplementation = require('./implementation');

// Loaded on demand so the legacy client is only required when it's selected
const IMPLEMENTATIONS = {
    legacy: () => require('./legacy/ElasticSearch'),
    fetch: () => require('./fetch/ElasticSearch'),
};

class ElasticSearch {
    /**
     * @param {object} clientConfig Client config, plus `implementation` to choose between `legacy` (default) and `fetch`
     */
    constructor(clientConfig) {
        const { name, config } = splitImplementation(clientConfig);
        const Implementation = IMPLEMENTATIONS[name]();

        this.implementation = new Implementation(config);
    }

    /**
     * Write an event to ElasticSearch
     * @param {Object} data Event data to index
     * @param {Object | string} index Index - either string representing the index or a property bag containing the index and other parameters
     */
    index(data, index) {
        return this.implementation.index(data, index);
    }

    /**
     * Write a batch of events to ElasticSearch in a single bulk request
     * @param {Array<{index: string, document: Object}>} operations Events to index, each with its target index
     * @returns {Promise<void>}
     */
    bulk(operations) {
        return this.implementation.bulk(operations);
    }
}

module.exports = ElasticSearch;
