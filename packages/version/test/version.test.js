const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const modulePath = require.resolve('../lib/version');

const loadVersionModuleFor = function loadVersionModuleFor(version) {
    const previousCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'version-test-'));

    try {
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({version}));
        process.chdir(tempDir);
        delete require.cache[modulePath];
        return require('../lib/version');
    } finally {
        process.chdir(previousCwd);
        fs.rmSync(tempDir, {recursive: true, force: true});
        delete require.cache[modulePath];
    }
};

describe('Version', function () {
    it('default', function () {
        const version = '1.10.0';
        const ghostVersionUtils = loadVersionModuleFor(version);

        assert.equal(ghostVersionUtils.full, version);
        assert.equal(ghostVersionUtils.original, version);
        assert.equal(ghostVersionUtils.safe, '1.10');
    });

    it('pre-release', function () {
        const version = '1.11.1-beta';
        const ghostVersionUtils = loadVersionModuleFor(version);

        assert.equal(ghostVersionUtils.full, version);
        assert.equal(ghostVersionUtils.original, version);
        assert.equal(ghostVersionUtils.safe, '1.11');
    });

    it('pre-release .1', function () {
        const version = '1.11.1-alpha.1';
        const ghostVersionUtils = loadVersionModuleFor(version);

        assert.equal(ghostVersionUtils.full, version);
        assert.equal(ghostVersionUtils.original, version);
        assert.equal(ghostVersionUtils.safe, '1.11');
    });

    it('build', function () {
        const version = '1.11.1+build';
        const ghostVersionUtils = loadVersionModuleFor(version);

        assert.equal(ghostVersionUtils.full, '1.11.1');
        assert.equal(ghostVersionUtils.original, version);
        assert.equal(ghostVersionUtils.safe, '1.11');
    });

    it('mixed', function () {
        const version = '1.11.1-pre+build.1';
        const ghostVersionUtils = loadVersionModuleFor(version);

        assert.equal(ghostVersionUtils.full, '1.11.1-pre');
        assert.equal(ghostVersionUtils.original, version);
        assert.equal(ghostVersionUtils.safe, '1.11');
    });

    it('mixed 1', function () {
        const version = '1.11.1-beta.12+build.2';
        const ghostVersionUtils = loadVersionModuleFor(version);

        assert.equal(ghostVersionUtils.full, '1.11.1-beta.12');
        assert.equal(ghostVersionUtils.original, version);
        assert.equal(ghostVersionUtils.safe, '1.11');
    });
});
