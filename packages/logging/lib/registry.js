const { version } = require('../package.json');

/**
 * Key of the `globalThis` slot that holds the process-wide (per-thread) logger.
 * See `lib/logging.js` for why it is a `Symbol.for` key gated on the MAJOR
 * version.
 */
const registryKey = Symbol.for(`@tryghost/logging@${parseInt(version, 10)}`);

/**
 * @description Get the process-wide logger, if one exists yet.
 *
 * Builds nothing: returns `undefined` until the main entry point has built its
 * logger or `setInstance()` has registered one.
 *
 * @returns {object | undefined}
 */
function getInstance() {
    return globalThis[registryKey];
}

/**
 * @description Make `instance` the process-wide logger that `require('@tryghost/logging')` returns.
 *
 * Must run before anything loads the main entry point (in any copy of this
 * major): once a different instance exists, replacing it would leave earlier
 * importers holding a second logger, so this throws instead. Use
 * `getInstance()` first to adopt an existing logger rather than build one.
 *
 * @param {object} instance The logger to register
 * @returns {object} The registered instance
 */
function setInstance(instance) {
    if (instance === null || typeof instance !== 'object') {
        throw new TypeError('@tryghost/logging: setInstance() requires a logger instance');
    }

    const existing = globalThis[registryKey];

    if (existing && existing !== instance) {
        throw new Error(
            '@tryghost/logging: setInstance() was called after a different logger instance was created for this process. ' +
                "Call setInstance() before anything requires '@tryghost/logging'.",
        );
    }

    globalThis[registryKey] = instance;
    return instance;
}

module.exports = { registryKey, getInstance, setInstance };
