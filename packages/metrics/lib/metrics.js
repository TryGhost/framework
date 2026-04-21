const path = require('path');
const { getProcessRoot } = require('@tryghost/root-utils');
const GhostMetrics = require('./GhostMetrics');

// Metrics piggy-backs on logging config for transport configuration
let loggingConfig;
try {
    loggingConfig = require(path.join(getProcessRoot(), 'loggingrc'));
} catch {
    loggingConfig = {};
}

module.exports = new GhostMetrics(loggingConfig);
module.exports.GhostMetrics = GhostMetrics;
