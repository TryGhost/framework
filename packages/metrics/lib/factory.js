const GhostMetrics = require('./GhostMetrics');
const { getInstance, setInstance } = require('./registry');

// Side-effect free entry point: importing this builds no metrics instance and
// reads no `loggingrc`, unlike the main entry point.
module.exports = { GhostMetrics, getInstance, setInstance };
