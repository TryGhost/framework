const getConfig = require('./get-config');

const config = getConfig();
function initConfig() {
    return config;
}

/**
 * @description Initialise nconf config object.
 *
 * The config object is cached, once it has been setup with the parent
 */
module.exports = initConfig();
