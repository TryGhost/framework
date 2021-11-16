const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const rootUtils = require('@tryghost/root-utils');
let config;

const env = process.env.NODE_ENV || 'development';

/**
 * @description Setup the config object.
 */
const setupConfig = function setupConfig() {
    const defaults = {};
    const parentPath = rootUtils.getProcessRoot();

    config = new nconf.Provider();

    if (parentPath && fs.existsSync(path.join(parentPath, 'config.example.json'))) {
        Object.assign(defaults, require(path.join(parentPath, 'config.example.json')));
    }

    config.argv()
        .env({
            separator: '__'
        })
        .file({
            file: path.join(parentPath, 'config.' + env + '.json')
        });

    config.set('env', env);

    config.defaults(defaults);
};

/**
 * @description Initialise nconf config object.
 *
 * The config object is cached, once it has been setup with the parent
 *
 * @param {boolean} noCache - used for tests only, to reinit the cache on every call
 */
module.exports = function initConfig(noCache) {
    if (!config || noCache) {
        setupConfig();
    }

    return config;
};