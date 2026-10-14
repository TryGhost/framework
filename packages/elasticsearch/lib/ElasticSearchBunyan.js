const splitImplementation = require('./implementation');

// Loaded on demand so the legacy client is only required when it's selected
const IMPLEMENTATIONS = {
    legacy: () => require('./legacy/ElasticSearchBunyan'),
    fetch: () => require('./fetch/ElasticSearchBunyan'),
};

/**
 * @deprecated Will be removed in a future major version, along with the
 * `elasticsearch` transport in `@tryghost/logging`.
 */
class ElasticSearchBunyan {
    /**
     * @param {object} clientConfig Client config, plus `implementation` to choose between `legacy` (default) and `fetch`
     * @param {string} index
     * @param {string} [pipeline]
     */
    constructor(clientConfig, index, pipeline) {
        const { name, config } = splitImplementation(clientConfig);
        const Implementation = IMPLEMENTATIONS[name]();

        this.implementation = new Implementation(config, index, pipeline);
    }

    getStream() {
        return this.implementation.getStream();
    }

    /**
     * Force any buffered documents to ship and wait for them to be sent
     * @returns {Promise<void>}
     */
    flush() {
        return this.implementation.flush();
    }
}

module.exports = ElasticSearchBunyan;
