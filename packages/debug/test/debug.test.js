const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const debugModulePath = require.resolve('../lib/debug');
const rootUtilsPath = require.resolve('@tryghost/root-utils');
const baseDebugPath = require.resolve('debug');

function createTempPackageJson(contents) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-pkg-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(contents), 'utf8');
    return dir;
}

function loadDebugWithStubs({callerRoot, baseDebugStub}) {
    const originalRootUtils = require(rootUtilsPath);
    const originalBaseDebug = require(baseDebugPath);

    require.cache[rootUtilsPath].exports = {
        ...originalRootUtils,
        getCallerRoot: () => callerRoot
    };
    require.cache[baseDebugPath].exports = baseDebugStub;
    delete require.cache[debugModulePath];

    const initDebug = require('../');
    const lib = require('../lib/debug');

    return {
        initDebug,
        lib,
        restore() {
            require.cache[rootUtilsPath].exports = originalRootUtils;
            require.cache[baseDebugPath].exports = originalBaseDebug;
            delete require.cache[debugModulePath];
            delete require.cache[require.resolve('../index')];
        }
    };
}

describe('debug', function () {
    it('uses package alias when present', function () {
        const callerRoot = createTempPackageJson({name: 'pkg-name', alias: '@alias/pkg'});
        let receivedNamespace;
        const baseDebugStub = (namespace) => {
            receivedNamespace = namespace;
            return {namespace};
        };

        const {initDebug, restore} = loadDebugWithStubs({callerRoot, baseDebugStub});

        try {
            const instance = initDebug('test');
            assert.equal(instance.namespace, '@alias/pkg:test');
            assert.equal(receivedNamespace, '@alias/pkg:test');
        } finally {
            restore();
            fs.rmSync(callerRoot, {recursive: true, force: true});
        }
    });

    it('uses package name when alias is missing', function () {
        const callerRoot = createTempPackageJson({name: '@tryghost/debug'});
        const baseDebugStub = namespace => ({namespace});

        const {initDebug, restore} = loadDebugWithStubs({callerRoot, baseDebugStub});

        try {
            const instance = initDebug('test');
            assert.equal(instance.namespace, '@tryghost/debug:test');
        } finally {
            restore();
            fs.rmSync(callerRoot, {recursive: true, force: true});
        }
    });

    it('falls back to undefined namespace when package.json cannot be loaded', function () {
        const missingRoot = path.join(os.tmpdir(), 'missing-debug-root');
        const baseDebugStub = namespace => ({namespace});

        const {initDebug, restore} = loadDebugWithStubs({callerRoot: missingRoot, baseDebugStub});

        try {
            const instance = initDebug('test');
            assert.equal(instance.namespace, 'undefined:test');
        } finally {
            restore();
        }
    });

    it('exposes the base debug module as _base', function () {
        const callerRoot = createTempPackageJson({name: '@tryghost/debug'});
        const baseDebugStub = () => ({namespace: 'unused'});

        const {lib, restore} = loadDebugWithStubs({callerRoot, baseDebugStub});

        try {
            assert.equal(lib._base, baseDebugStub);
        } finally {
            restore();
            fs.rmSync(callerRoot, {recursive: true, force: true});
        }
    });
});
