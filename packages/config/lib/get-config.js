const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const rootUtils = require('@tryghost/root-utils');
const {parse: parseJsonc} = require('jsonc-parser');

const env = process.env.NODE_ENV || 'development';

function loadJsonOrJsonc(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return parseJsonc(content);
}

function findConfigFile(parentPath, baseName) {
    // Try .json first for backward compatibility, then .jsonc
    const jsonPath = path.join(parentPath, baseName + '.json');
    const jsoncPath = path.join(parentPath, baseName + '.jsonc');
    
    if (fs.existsSync(jsonPath)) {
        return jsonPath;
    }
    if (fs.existsSync(jsoncPath)) {
        return jsoncPath;
    }
    
    return null;
}

module.exports = function getConfig() {
    const defaults = {};
    const parentPath = rootUtils.getProcessRoot();

    const config = new nconf.Provider();

    // Load example config (supports both .json and .jsonc)
    if (parentPath) {
        const exampleConfigPath = findConfigFile(parentPath, 'config.example');
        if (exampleConfigPath) {
            const exampleConfig = loadJsonOrJsonc(exampleConfigPath);
            if (exampleConfig) {
                Object.assign(defaults, exampleConfig);
            }
        }
    }

    config.argv()
        .env({
            separator: '__'
        });

    // Load environment-specific config (supports both .json and .jsonc)
    if (parentPath) {
        const envConfigPath = findConfigFile(parentPath, 'config.' + env);
        if (envConfigPath) {
            const envConfig = loadJsonOrJsonc(envConfigPath);
            if (envConfig) {
                config.overrides(envConfig);
            }
        }
    }

    config.set('env', env);

    config.defaults(defaults);

    return config;
};