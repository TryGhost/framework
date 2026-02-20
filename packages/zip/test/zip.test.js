const assert = require('assert/strict');
const path = require('path');
const fs = require('fs-extra');
const {hashElement} = require('folder-hash');
const archiver = require('archiver');
const EventEmitter = require('events');
const Module = require('module');

// Mimic how we expect this to be required
const {compress, extract} = require('../');

describe('Compress and Extract should be opposite functions', function () {
    let symlinkPath, themeFolder, zipDestination, unzipDestination;

    const cleanUp = () => {
        fs.removeSync(symlinkPath);
        fs.removeSync(zipDestination);
        fs.removeSync(unzipDestination);
    };

    before(function () {
        symlinkPath = path.join(__dirname, 'fixtures', 'theme-symlink');
        themeFolder = path.join(__dirname, 'fixtures', 'test-theme');
        zipDestination = path.join(__dirname, 'fixtures', 'test-theme.zip');
        unzipDestination = path.join(__dirname, 'fixtures', 'test-theme-unzipped');

        cleanUp();
    });

    after(function () {
        cleanUp();
    });

    it('ensure symlinks work', function (done) {
        fs.symlinkSync(themeFolder, symlinkPath);

        let originalHash;

        hashElement(symlinkPath)
            .then((_originalHash) => {
                originalHash = _originalHash;
                return compress(symlinkPath, zipDestination);
            })
            .then((res) => {
                assert.equal(typeof res, 'object');
                assert.equal(res.path, zipDestination);
                assert.equal(res.size < 619618, true);

                return extract(zipDestination, unzipDestination);
            })
            .then((res) => {
                assert.equal(typeof res, 'object');
                assert.equal(res.path, unzipDestination);

                return hashElement(unzipDestination);
            })
            .then((extractedHash) => {
                assert.equal(originalHash.children.toString(), extractedHash.children.toString());

                done();
            })
            .catch((err) => {
                return done(err);
            });
    });

    it('rejects when archiver emits an async error event', async function () {
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === 'archiver') {
                return {
                    create() {
                        const fake = new EventEmitter();
                        fake.glob = function () {};
                        fake.pipe = function () {};
                        fake.finalize = function () {
                            setTimeout(() => fake.emit('error', new Error('archive failed')), 0);
                        };
                        return fake;
                    }
                };
            }

            return originalLoad(request, parent, isMain);
        };

        try {
            await assert.rejects(
                () => compress(themeFolder, zipDestination),
                /archive failed/
            );
        } finally {
            Module._load = originalLoad;
        }
    });
});

describe('Extract zip', function () {
    let themeFolder, zipDestination, unzipDestination, symLinkPath, longFilePath;

    before(function () {
        themeFolder = path.join(__dirname, 'fixtures', 'test-theme');
        zipDestination = path.join(__dirname, 'fixtures', 'test-theme.zip');
        unzipDestination = path.join(__dirname, 'fixtures', 'test-theme-unzipped');
        symLinkPath = path.join(__dirname, 'fixtures', 'test-theme-symlink');
    });

    afterEach(function () {
        if (fs.existsSync(zipDestination)) {
            fs.removeSync(zipDestination);
        }

        if (fs.existsSync(unzipDestination)) {
            fs.removeSync(unzipDestination);
        }

        if (fs.existsSync(symLinkPath)) {
            fs.removeSync(symLinkPath);
        }

        if (fs.existsSync(longFilePath)) {
            fs.removeSync(longFilePath);
        }
    });

    it('extracts a zip file', async function () {
        await compress(themeFolder, zipDestination);

        await extract(zipDestination, unzipDestination);

        assert.equal(fs.existsSync(unzipDestination), true);
        assert.equal(fs.existsSync(path.join(unzipDestination, 'package.json')), true);
    });

    it('throws if the zip contains a filename with 254 or more bytes', async function () {
        const longFileName = 'a'.repeat(250) + '.txt'; // 254 bytes
        longFilePath = path.join(themeFolder, longFileName);

        fs.writeFileSync(longFilePath, 'test content');

        await compress(themeFolder, zipDestination);
        await assert.rejects(
            () => extract(zipDestination, unzipDestination),
            /File names in the zip folder must be shorter than 254 characters\./
        );
    });

    it('throws when the zip contains symlink entries', async function () {
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipDestination);
            const archive = archiver('zip');

            output.on('close', resolve);
            archive.on('error', reject);
            archive.pipe(output);
            archive.symlink('themes/test-target', 'symlink-entry');
            archive.finalize();
        });

        await assert.rejects(
            () => extract(zipDestination, unzipDestination),
            /Symlinks are not allowed in the zip folder\./
        );
    });

    it('forwards custom onEntry callback', async function () {
        await compress(themeFolder, zipDestination);

        let called = false;
        await extract(zipDestination, unzipDestination, {
            onEntry: () => {
                called = true;
            }
        });

        assert.equal(called, true);
    });
});
