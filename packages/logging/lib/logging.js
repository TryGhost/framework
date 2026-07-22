const path = require('path');
const { isMainThread } = require('worker_threads');
const { getProcessRoot } = require('@tryghost/root-utils');
const GhostLogger = require('./GhostLogger');
const { version } = require('../package.json');

/**
 * Reuse a single logger instance across duplicate copies of this package that
 * may co-exist in the node_modules tree.
 *
 * Node's module cache only guarantees one instance per *physical* copy of the
 * package, so when the package fails to dedupe (incompatible ranges across
 * consumers, peer-dep quirks) each copy constructs its own logger — and each
 * RotatingFileStream then opens the *same* log path. Multiple rotating writers
 * renaming/gzipping the same file corrupts rotation, so we must have exactly
 * one instance per process (per thread).
 *
 * The instance is cached on `globalThis` under a key derived from the package
 * MAJOR version. `Symbol.for` is used so the key resolves to the same symbol in
 * every copy (the global symbol registry is shared process-wide); a plain
 * `Symbol()` would be unique per copy and could never match.
 *
 * Gating on MAJOR only is deliberate: patch/minor duplicates (the common
 * dedupe failure) share safely, but an incompatible major — which may have a
 * different config shape or API — gets its own instance rather than silently
 * reusing one built by a different major.
 */
const registryKey = Symbol.for(`@tryghost/logging@${parseInt(version, 10)}`);

function createLogger() {
    let loggingConfig;
    try {
        loggingConfig = require(path.join(getProcessRoot(), 'loggingrc'));
    } catch {
        loggingConfig = {};
    }

    if (!isMainThread) {
        loggingConfig.transports = ['parent'];
    }

    return new GhostLogger(loggingConfig);
}

// worker_threads each get their own `globalThis`, so a worker still constructs
// its own instance with the correct 'parent' transport — the main-thread logger
// is never shared into a worker.
module.exports = globalThis[registryKey] || (globalThis[registryKey] = createLogger());
module.exports.GhostLogger = GhostLogger;

/**
 * @description Clear the cached process-wide logger instance.
 *
 * Only intended for tests: the instance is cached on `globalThis` and therefore
 * survives `require`-cache resets within a process, so tests that need a fresh
 * logger must clear it explicitly.
 */
module.exports.resetForTesting = function resetForTesting() {
    delete globalThis[registryKey];
};
