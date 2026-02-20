const assert = require('assert/strict');
const {join} = require('path');

const rootUtils = require('@tryghost/root-utils');

const realRoot = rootUtils.getProcessRoot();
const getConfigPath = require.resolve('../lib/get-config');
const configPath = require.resolve('../lib/config');
const indexPath = require.resolve('../index');

function fixturePath(path) {
    return join(realRoot, '/test/fixtures', path || '');
}

function withRoot(root, fn) {
    const original = rootUtils.getProcessRoot;
    rootUtils.getProcessRoot = () => root;
    try {
        return fn();
    } finally {
        rootUtils.getProcessRoot = original;
    }
}

function withEnv(nodeEnv, fn) {
    const original = process.env.NODE_ENV;
    if (nodeEnv === undefined) {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = nodeEnv;
    }

    try {
        return fn();
    } finally {
        if (original === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = original;
        }
    }
}

function loadFreshGetConfig() {
    delete require.cache[getConfigPath];
    return require('../lib/get-config');
}

describe('Config', function () {
    it('Empty config when no configuration file found', function () {
        const config = withEnv('testing', () => withRoot('/tmp', () => loadFreshGetConfig()()));

        assert.equal(config.get('test'), undefined);
        assert.equal(config.get('should-be-used'), undefined);
        assert.equal(config.get('env'), 'testing');
    });

    it('Reads configuration file when exists', function () {
        const config = withEnv('testing', () => withRoot(fixturePath(), () => loadFreshGetConfig()()));

        assert.equal(config.stores.file.file.endsWith('config/test/fixtures/config.testing.json'), true);
        assert.equal(config.get('hello'), 'world');
        assert.equal(config.get('test'), 'root-config');
        assert.equal(config.get('should-be-used'), true);
        assert.equal(config.get('env'), 'testing');
    });

    it('defaults env to development when NODE_ENV is not set', function () {
        const config = withEnv(undefined, () => withRoot('/tmp', () => loadFreshGetConfig()()));
        assert.equal(config.get('env'), 'development');
    });

    it('index exports lib/config and only initializes config once', function () {
        const originalGetConfig = require(getConfigPath);
        const fakeConfig = {name: 'fake-config'};
        let callCount = 0;

        try {
            require.cache[getConfigPath].exports = () => {
                callCount += 1;
                return fakeConfig;
            };

            delete require.cache[configPath];
            delete require.cache[indexPath];

            const configFromLib = require('../lib/config');
            const configFromIndex = require('../');

            assert.equal(configFromLib, fakeConfig);
            assert.equal(configFromIndex, fakeConfig);
            assert.equal(callCount, 1);
        } finally {
            require.cache[getConfigPath].exports = originalGetConfig;
            delete require.cache[configPath];
            delete require.cache[indexPath];
        }
    });
});
