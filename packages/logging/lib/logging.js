const path = require('path');
const {getProcessRoot} = require('@tryghost/root-utils');
const GhostLogger = require('./GhostLogger');

let loggingConfig;
try {
    loggingConfig = require(path.join(getProcessRoot(), 'loggingrc'));
} catch (err) {
    loggingConfig = {};
}

module.exports = new GhostLogger(loggingConfig);
module.exports.GhostLogger = GhostLogger;
