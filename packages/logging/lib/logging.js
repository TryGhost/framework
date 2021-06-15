const path = require('path');
const {getProcessRoot} = require('@tryghost/root-utils');
const loggingConfig = require(path.join(getProcessRoot(), 'loggingrc'));
const GhostLogger = require('./GhostLogger');

module.exports = new GhostLogger(loggingConfig);
module.exports.GhostLogger = GhostLogger;
