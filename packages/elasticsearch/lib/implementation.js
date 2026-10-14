/**
 * Split the implementation choice out of a client config. `legacy` (the
 * default) uses the official @elastic/elasticsearch client, `fetch` uses
 * Node's built-in fetch.
 * @param {{implementation?: string}} clientConfig
 * @returns {{name: 'legacy' | 'fetch', config: object}}
 */
module.exports = function splitImplementation(clientConfig) {
    const { implementation, ...config } = clientConfig;

    return {
        name: implementation === 'fetch' ? 'fetch' : 'legacy',
        config,
    };
};
