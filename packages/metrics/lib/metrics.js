const path = require('path');
const { getProcessRoot } = require('@tryghost/root-utils');
const GhostMetrics = require('./GhostMetrics');
const { getRegisteredInstance, markDefaultBuilt } = require('./registry');

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

// An instance registered through `@tryghost/metrics/factory` wins. Otherwise
// each copy of this package builds its own instance, as it always has.
module.exports = getRegisteredInstance() || markDefaultBuilt(createMetrics());
module.exports.GhostMetrics = GhostMetrics;
