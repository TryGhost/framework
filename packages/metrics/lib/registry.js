const { version } = require('../package.json');

const major = parseInt(version, 10);

/**
 * `globalThis` slot holding the instance registered with `setInstance()`.
 *
 * `Symbol.for` resolves to the same symbol in every physical copy of this
 * package in the node_modules tree, so a registered instance is returned by
 * the main entry of every copy of the same MAJOR version. Incompatible majors
 * get their own slot. `globalThis` is per thread, so nothing is shared with
 * worker threads.
 */
const registryKey = Symbol.for(`@tryghost/metrics@${major}`);

/**
 * `globalThis` slot remembering the first instance a main entry built for
 * itself from `loggingrc`. It only exists so a too-late `setInstance()` can be
 * detected; main entries never read an instance back from it.
 */
const defaultBuiltKey = Symbol.for(`@tryghost/metrics@${major}:default`);

/**
 * @description Get the instance registered with `setInstance()`, if any
 * @returns {object | undefined}
 */
function getRegisteredInstance() {
    return globalThis[registryKey];
}

/**
 * @description Record that a main entry built its own default instance
 * @param {object} instance The instance the main entry built
 * @returns {object} The same instance
 */
function markDefaultBuilt(instance) {
    globalThis[defaultBuiltKey] ??= instance;
    return instance;
}

/**
 * @description Make `instance` the process-wide metrics instance that `require('@tryghost/metrics')` returns.
 *
 * Must run before anything loads the main entry point (in any copy of this
 * major): once a different instance exists, earlier importers already hold it,
 * so this throws instead of leaving two instances in the process.
 *
 * @param {object} instance The instance to register, e.g. from `createMetrics()`
 * @returns {object} The registered instance
 */
function setInstance(instance) {
    if (instance === null || typeof instance !== 'object') {
        throw new TypeError('@tryghost/metrics: setInstance() requires a metrics instance');
    }

    const existing = globalThis[registryKey] || globalThis[defaultBuiltKey];

    if (existing && existing !== instance) {
        throw new Error(
            '@tryghost/metrics: setInstance() was called after a different metrics instance was created for this process. ' +
                "Call setInstance() before anything requires '@tryghost/metrics'.",
        );
    }

    globalThis[registryKey] = instance;
    return instance;
}

module.exports = {
    registryKey,
    defaultBuiltKey,
    getRegisteredInstance,
    markDefaultBuilt,
    setInstance,
};
