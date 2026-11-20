const { version } = require('../package.json');

/**
 * Key of the `globalThis` slot that holds the process-wide (per-thread)
 * metrics instance. See `lib/metrics.js` for why it is a `Symbol.for` key
 * gated on the MAJOR version.
 */
const registryKey = Symbol.for(`@tryghost/metrics@${parseInt(version, 10)}`);

/**
 * @description Get the process-wide metrics instance, if one exists yet.
 *
 * Builds nothing: returns `undefined` until the main entry point has built its
 * instance or `setInstance()` has registered one.
 *
 * @returns {object | undefined}
 */
function getInstance() {
    return globalThis[registryKey];
}

/**
 * @description Make `instance` the process-wide metrics instance that `require('@tryghost/metrics')` returns.
 *
 * Must run before anything loads the main entry point (in any copy of this
 * major): once a different instance exists, earlier importers already hold it,
 * so this throws instead of leaving two instances in the process. Use
 * `getInstance()` first to adopt an existing instance rather than build one.
 *
 * @param {object} instance The instance to register
 * @returns {object} The registered instance
 */
function setInstance(instance) {
    if (instance === null || typeof instance !== 'object') {
        throw new TypeError('@tryghost/metrics: setInstance() requires a metrics instance');
    }

    const existing = globalThis[registryKey];

    if (existing && existing !== instance) {
        throw new Error(
            '@tryghost/metrics: setInstance() was called after a different metrics instance was created for this process. ' +
                "Call setInstance() before anything requires '@tryghost/metrics'.",
        );
    }

    globalThis[registryKey] = instance;
    return instance;
}

module.exports = { registryKey, getInstance, setInstance };
