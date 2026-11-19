const GhostMetrics = require('./GhostMetrics');
const { setInstance } = require('./registry');

/**
 * @description Build a metrics instance from the options passed in.
 *
 * Unlike the main entry point this reads no `loggingrc` and does not register
 * the instance anywhere. The constructor's environment overrides (`MODE`,
 * `LOIN`) still apply.
 *
 * @param {object} [options] `GhostMetrics` constructor options
 * @returns {GhostMetrics}
 */
function createMetrics(options) {
    return new GhostMetrics(options);
}

module.exports = { GhostMetrics, createMetrics, setInstance };
