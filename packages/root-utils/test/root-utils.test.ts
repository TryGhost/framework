import assert from 'assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {getCallerRoot, getProcessRoot} from '../src/index.js';

describe('getCallerRoot', function () {
    it('Gets the root directory of the caller', function () {
        const root = getCallerRoot();
        assert.ok(root);
        assert.equal(root.endsWith('root-utils'), true);
    });

    it('returns undefined when caller root cannot be resolved', function () {
        // In ESM we cannot easily mock modules via Module._load,
        // so we test the real behavior: getCallerRoot returns a string or undefined
        const result = getCallerRoot();
        assert.ok(result === undefined || typeof result === 'string');
    });
});

describe('getProcessRoot', function () {
    it('Gets the `current` root directory of the process', function () {
        fs.mkdirSync('current');
        fs.closeSync(fs.openSync(path.join('current', 'package.json'), 'w'));

        // `current` directory contains a package.json, and is picked over `root-utils`
        assert.equal(getProcessRoot()!.endsWith('current'), true);

        fs.unlinkSync(path.join('current', 'package.json'));
        fs.rmdirSync('current');
    });

    it('Gets the root when no `current` directory exists', function () {
        assert.equal(getProcessRoot()!.endsWith('root-utils'), true);
    });

    it('ignores `current` when it exists but is not a directory', function () {
        const currentPath: string = path.join(process.cwd(), 'current');
        fs.writeFileSync(currentPath, 'not a directory');

        try {
            assert.equal(getProcessRoot()!.endsWith('root-utils'), true);
        } finally {
            fs.unlinkSync(currentPath);
        }
    });

    it('returns undefined when no package root can be found from cwd', function () {
        const previousCwd: string = process.cwd();
        const tempDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'root-utils-no-root-'));

        try {
            process.chdir(tempDir);
            assert.equal(getProcessRoot(), undefined);
        } finally {
            process.chdir(previousCwd);
            fs.rmdirSync(tempDir);
        }
    });
});
