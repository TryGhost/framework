const GhostLogger = require('./GhostLogger');
const { getInstance, setInstance } = require('./registry');

// Side-effect free entry point: importing this builds no logger and reads no
// `loggingrc`, unlike the main entry point.
module.exports = { GhostLogger, getInstance, setInstance };
