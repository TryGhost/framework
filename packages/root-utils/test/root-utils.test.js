const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');
const {getCallerRoot, getProcessRoot} = require('../index');
const rootUtilsModulePath = require.resolve('../lib/root-utils');

function loadRootUtilsWithMocks(mocks) {
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad(request, parent, isMain);
    };

    delete require.cache[rootUtilsModulePath];
    const loaded = require('../lib/root-utils');

    Module._load = originalLoad;
    delete require.cache[rootUtilsModulePath];
    return loaded;
}

describe('getCallerRoot', function () {
    it('Gets the root directory of the caller', function () {
        // mocha calls the test function calls getCallerRoot
        assert.equal(getCallerRoot().endsWith('mocha'), true);
    });

    it('returns undefined when caller root cannot be resolved', function () {
        const mockedModule = loadRootUtilsWithMocks({
            caller: () => '/tmp/no-root-here.js',
            'find-root': () => {
                throw new Error('no package root');
            }
        });

        assert.equal(mockedModule.getCallerRoot(), undefined);
    });
});

describe('getProcessRoot', function () {
    it('Gets the `current` root directory of the process', function () {
        fs.mkdirSync('current');
        fs.closeSync(fs.openSync(path.join('current', 'package.json'), 'w'));

        // `current` directory contains a package.json, and is picked over `root-utils`
        assert.equal(getProcessRoot().endsWith('current'), true);

        fs.unlinkSync(path.join('current', 'package.json'));
        fs.rmdirSync('current');
    });

    it('Gets the root when no `current` directory exists', function () {
        assert.equal(getProcessRoot().endsWith('root-utils'), true);
    });

    it('ignores `current` when it exists but is not a directory', function () {
        const currentPath = path.join(process.cwd(), 'current');
        fs.writeFileSync(currentPath, 'not a directory');

        try {
            assert.equal(getProcessRoot().endsWith('root-utils'), true);
        } finally {
            fs.unlinkSync(currentPath);
        }
    });

    it('returns undefined when no package root can be found from cwd', function () {
        const previousCwd = process.cwd();
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'root-utils-no-root-'));

        try {
            process.chdir(tempDir);
            assert.equal(getProcessRoot(), undefined);
        } finally {
            process.chdir(previousCwd);
            fs.rmdirSync(tempDir);
        }
    });
});
