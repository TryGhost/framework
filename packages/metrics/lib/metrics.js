const path = require('path');
const { getProcessRoot } = require('@tryghost/root-utils');
const GhostMetrics = require('./GhostMetrics');
const { registryKey } = require('./registry');

/**
 * Reuse a single metrics instance across duplicate copies of this package that
 * may co-exist in the node_modules tree, the same way `@tryghost/logging`
 * shares its logger.
 *
 * Node's module cache only guarantees one instance per *physical* copy of the
 * package, so when the package fails to dedupe each copy would otherwise build
 * its own instance, each with its own transports and Elasticsearch client.
 *
 * The instance is cached on `globalThis` under a `Symbol.for` key derived from
 * the package MAJOR version, so every copy of the same major resolves the same
 * slot and an incompatible major gets its own. `globalThis` is per thread, so a
 * worker thread builds its own instance.
 *
 * The key lives in `./registry` so `@tryghost/metrics/factory` can read and
 * register an instance without loading this file.
 */
function createMetrics() {
    // Metrics piggy-backs on logging config for transport configuration
    let loggingConfig;
    try {
        loggingConfig = require(path.join(getProcessRoot(), 'loggingrc'));
    } catch {
        loggingConfig = {};
    }

    return new GhostMetrics(loggingConfig);
}

module.exports = globalThis[registryKey] || (globalThis[registryKey] = createMetrics());
module.exports.GhostMetrics = GhostMetrics;

/**
 * @description Clear the cached process-wide metrics instance.
 *
 * Only intended for tests: the instance is cached on `globalThis` and therefore
 * survives `require`-cache resets within a process, so tests that need a fresh
 * instance must clear it explicitly.
 */
module.exports.resetForTesting = function resetForTesting() {
    delete globalThis[registryKey];
};
