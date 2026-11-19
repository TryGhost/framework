const GhostLogger = require('./GhostLogger');
const { setInstance } = require('./registry');

/**
 * @description Build a logger from the options passed in.
 *
 * Unlike the main entry point this reads no `loggingrc`, does not register the
 * logger anywhere and does not adjust transports in worker threads. The
 * constructor's environment overrides (`LEVEL`, `MODE`, `LOIN`) still apply.
 *
 * @param {object} [options] `GhostLogger` constructor options
 * @returns {GhostLogger}
 */
function createLogger(options) {
    return new GhostLogger(options);
}

module.exports = { GhostLogger, createLogger, setInstance };
