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
        const callerRoot = getCallerRoot();
        expect(typeof callerRoot).toBe('string');
        expect(fs.existsSync(path.join(callerRoot, 'package.json'))).toBe(true);
    });

    it('returns undefined when caller root cannot be resolved', function () {
        const mockedModule = loadRootUtilsWithMocks({
            caller: () => '/tmp/no-root-here.js',
            'find-root': () => {
                throw new Error('no package root');
            }
        });

        expect(mockedModule.getCallerRoot()).toBeUndefined();
    });
});

describe('getProcessRoot', function () {
    it('Gets the `current` root directory of the process', function () {
        const currentDirectory = path.join(process.cwd(), 'current');
        const packageJSONPath = path.join(currentDirectory, 'package.json');

        fs.mkdirSync(currentDirectory);
        fs.closeSync(fs.openSync(packageJSONPath, 'w'));

        try {
            expect(getProcessRoot()).toBe(currentDirectory);
        } finally {
            fs.unlinkSync(packageJSONPath);
            fs.rmdirSync(currentDirectory);
        }
    });

    it('Gets the root when no `current` directory exists', function () {
        expect(getProcessRoot()).toBe(path.join(__dirname, '..'));
    });

    it('ignores `current` when it exists but is not a directory', function () {
        const currentPath = path.join(process.cwd(), 'current');
        fs.writeFileSync(currentPath, 'not a directory');

        try {
            expect(getProcessRoot().endsWith('root-utils')).toBe(true);
        } finally {
            fs.unlinkSync(currentPath);
        }
    });

    it('returns undefined when no package root can be found from cwd', function () {
        const previousCwd = process.cwd();
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'root-utils-no-root-'));

        try {
            process.chdir(tempDir);
            expect(getProcessRoot()).toBeUndefined();
        } finally {
            process.chdir(previousCwd);
            fs.rmdirSync(tempDir);
        }
    });
});
