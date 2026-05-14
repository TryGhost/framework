const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const { hashElement } = require('folder-hash');
const archiver = require('archiver');
const EventEmitter = require('events');
const Module = require('module');

// Mimic how we expect this to be required
const { compress, extract } = require('../');

function createZip(zipPath, addEntries) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip');
        let settled = false;

        const cleanup = () => {
            output.off('close', onClose);
            output.off('error', onError);
            archive.off('error', onError);
        };

        const onClose = () => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();
            resolve();
        };

        const onError = (err) => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();
            archive.abort();
            output.destroy();
            reject(err);
        };

        output.on('close', onClose);
        output.on('error', onError);
        archive.on('error', onError);
        archive.pipe(output);

        addEntries(archive);

        archive.finalize();
    });
}

function createZipWithEntries(zipPath, entries) {
    return createZip(zipPath, (archive) => {
        for (const entry of entries) {
            archive.append(entry.content, { name: entry.name });
        }
    });
}

describe('Compress and Extract should be opposite functions', function () {
    let symlinkPath, themeFolder, zipDestination, unzipDestination;

    const cleanUp = () => {
        fs.rmSync(symlinkPath, { recursive: true, force: true });
        fs.rmSync(zipDestination, { recursive: true, force: true });
        fs.rmSync(unzipDestination, { recursive: true, force: true });
    };

    beforeAll(function () {
        symlinkPath = path.join(__dirname, 'fixtures', 'theme-symlink');
        themeFolder = path.join(__dirname, 'fixtures', 'test-theme');
        zipDestination = path.join(__dirname, 'fixtures', 'test-theme.zip');
        unzipDestination = path.join(__dirname, 'fixtures', 'test-theme-unzipped');

        cleanUp();
    });

    afterAll(function () {
        cleanUp();
    });

    it('ensure symlinks work', async function () {
        fs.symlinkSync(themeFolder, symlinkPath);

        const originalHash = await hashElement(symlinkPath);

        const compressRes = await compress(symlinkPath, zipDestination);
        assert.equal(typeof compressRes, 'object');
        assert.equal(compressRes.path, zipDestination);
        assert.equal(compressRes.size < 619618, true);

        const extractRes = await extract(zipDestination, unzipDestination);
        assert.equal(typeof extractRes, 'object');
        assert.equal(extractRes.path, unzipDestination);

        const extractedHash = await hashElement(unzipDestination);
        assert.equal(originalHash.children.toString(), extractedHash.children.toString());
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
                    },
                };
            }

            return originalLoad(request, parent, isMain);
        };

        try {
            await assert.rejects(() => compress(themeFolder, zipDestination), /archive failed/);
        } finally {
            Module._load = originalLoad;
        }
    });
});

describe('Extract zip', function () {
    let themeFolder, zipDestination, unzipDestination, symLinkPath, longFilePath;

    beforeAll(function () {
        themeFolder = path.join(__dirname, 'fixtures', 'test-theme');
        zipDestination = path.join(__dirname, 'fixtures', 'test-theme.zip');
        unzipDestination = path.join(__dirname, 'fixtures', 'test-theme-unzipped');
        symLinkPath = path.join(__dirname, 'fixtures', 'test-theme-symlink');
    });

    afterEach(function () {
        if (fs.existsSync(zipDestination)) {
            fs.rmSync(zipDestination, { recursive: true, force: true });
        }

        if (fs.existsSync(unzipDestination)) {
            fs.rmSync(unzipDestination, { recursive: true, force: true });
        }

        if (fs.existsSync(symLinkPath)) {
            fs.rmSync(symLinkPath, { recursive: true, force: true });
        }

        if (fs.existsSync(longFilePath)) {
            fs.rmSync(longFilePath, { recursive: true, force: true });
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
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(
                    err.message,
                    'File names in the zip folder must be shorter than 254 characters.',
                );
                assert.equal(err.context, 'The zip contains a filename that is too long.');
                assert.equal(err.code, 'FILENAME_TOO_LONG');
                assert.deepEqual(err.errorDetails, {
                    entryName: longFileName,
                    observedBytes: 254,
                    limitBytes: 254,
                });
                return true;
            },
        );
    });

    it('throws when the zip contains symlink entries', async function () {
        await createZip(zipDestination, (archive) => {
            archive.symlink('themes/test-target', 'symlink-entry');
        });

        await assert.rejects(
            () => extract(zipDestination, unzipDestination),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(err.message, 'Symlinks are not allowed in the zip folder.');
                assert.equal(err.context, 'The zip contains a symlink entry.');
                assert.equal(err.code, 'SYMLINK_NOT_ALLOWED');
                assert.deepEqual(err.errorDetails, {
                    entryName: 'themes/test-target',
                });
                return true;
            },
        );
    });

    it('forwards custom onEntry callback', async function () {
        await compress(themeFolder, zipDestination);

        let called = false;
        await extract(zipDestination, unzipDestination, {
            onEntry: () => {
                called = true;
            },
        });

        assert.equal(called, true);
    });

    it('preserves existing behaviour for entries without uncompressed size when no limits are configured', async function () {
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === 'extract-zip') {
                return async (zipPath, opts) => {
                    opts.onEntry({ fileName: 'missing-size.txt', externalFileAttributes: 0 }, {});
                };
            }

            return originalLoad(request, parent, isMain);
        };

        try {
            const result = await extract(zipDestination, unzipDestination);

            assert.equal(result.path, unzipDestination);
        } finally {
            Module._load = originalLoad;
        }
    });

    it('throws when a limited entry has no uncompressed size', async function () {
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === 'extract-zip') {
                return async (zipPath, opts) => {
                    opts.onEntry({ fileName: 'missing-size.txt', externalFileAttributes: 0 }, {});
                };
            }

            return originalLoad(request, parent, isMain);
        };

        try {
            await assert.rejects(
                () =>
                    extract(zipDestination, unzipDestination, {
                        limits: {
                            perEntryUncompressedBytes: 1,
                        },
                    }),
                (err) => {
                    assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                    assert.equal(err.message, 'Zip entry has invalid uncompressed size.');
                    assert.equal(
                        err.context,
                        'The zip contains an entry with invalid uncompressed size metadata.',
                    );
                    assert.equal(err.code, 'INVALID_ENTRY_SIZE');
                    assert.deepEqual(err.errorDetails, {
                        entryName: 'missing-size.txt',
                        observedBytes: undefined,
                    });
                    return true;
                },
            );
        } finally {
            Module._load = originalLoad;
        }
    });

    it('throws when a limited entry has a non-numeric uncompressed size', async function () {
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === 'extract-zip') {
                return async (zipPath, opts) => {
                    opts.onEntry(
                        {
                            fileName: 'invalid-size.txt',
                            externalFileAttributes: 0,
                            uncompressedSize: Number.NaN,
                        },
                        {},
                    );
                };
            }

            return originalLoad(request, parent, isMain);
        };

        try {
            await assert.rejects(
                () =>
                    extract(zipDestination, unzipDestination, {
                        limits: {
                            totalUncompressedBytes: 1,
                        },
                    }),
                (err) => {
                    assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                    assert.equal(err.code, 'INVALID_ENTRY_SIZE');
                    assert.deepEqual(err.errorDetails, {
                        entryName: 'invalid-size.txt',
                        observedBytes: Number.NaN,
                    });
                    return true;
                },
            );
        } finally {
            Module._load = originalLoad;
        }
    });

    it('throws when an entry exceeds the per-entry uncompressed size limit', async function () {
        await createZipWithEntries(zipDestination, [{ name: 'big-file.txt', content: '12345' }]);

        await assert.rejects(
            () =>
                extract(zipDestination, unzipDestination, {
                    limits: {
                        perEntryUncompressedBytes: 4,
                    },
                }),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(err.message, 'Zip entry exceeds maximum uncompressed size.');
                assert.equal(
                    err.context,
                    'The zip contains an entry that exceeds the maximum uncompressed size.',
                );
                assert.equal(err.code, 'ENTRY_TOO_LARGE');
                assert.deepEqual(err.errorDetails, {
                    entryName: 'big-file.txt',
                    observedBytes: 5,
                    limitBytes: 4,
                });
                return true;
            },
        );
    });

    it('throws when entries exceed the total uncompressed size limit', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'first-file.txt', content: '123' },
            { name: 'second-file.txt', content: '456' },
        ]);

        await assert.rejects(
            () =>
                extract(zipDestination, unzipDestination, {
                    limits: {
                        totalUncompressedBytes: 5,
                    },
                }),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(err.message, 'Zip exceeds maximum total uncompressed size.');
                assert.equal(err.context, 'The zip exceeds the maximum total uncompressed size.');
                assert.equal(err.code, 'TOTAL_TOO_LARGE');
                assert.deepEqual(err.errorDetails, {
                    entryName: 'second-file.txt',
                    observedBytes: 6,
                    limitBytes: 5,
                    entriesProcessed: 2,
                });
                return true;
            },
        );
    });

    it('extracts large entries when no limits are configured', async function () {
        const largeFile = Buffer.alloc(1024 * 1024, 'a');

        await createZipWithEntries(zipDestination, [
            { name: 'large-file.txt', content: largeFile },
        ]);

        await extract(zipDestination, unzipDestination);

        const extractedFilePath = path.join(unzipDestination, 'large-file.txt');
        assert.equal(fs.existsSync(extractedFilePath), true);
        assert.equal(fs.statSync(extractedFilePath).size, largeFile.length);
    });

    it('extracts large entries when limits are explicitly Infinity', async function () {
        const largeFile = Buffer.alloc(1024 * 1024, 'a');

        await createZipWithEntries(zipDestination, [
            { name: 'large-file.txt', content: largeFile },
        ]);

        await extract(zipDestination, unzipDestination, {
            limits: {
                perEntryUncompressedBytes: Infinity,
                totalUncompressedBytes: Infinity,
            },
        });

        const extractedFilePath = path.join(unzipDestination, 'large-file.txt');
        assert.equal(fs.existsSync(extractedFilePath), true);
        assert.equal(fs.statSync(extractedFilePath).size, largeFile.length);
    });

    it('extracts entries within configured size limits', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'first-file.txt', content: '123' },
            { name: 'second-file.txt', content: '456' },
        ]);

        await extract(zipDestination, unzipDestination, {
            limits: {
                perEntryUncompressedBytes: 3,
                totalUncompressedBytes: 6,
            },
        });

        assert.equal(fs.existsSync(path.join(unzipDestination, 'first-file.txt')), true);
        assert.equal(fs.existsSync(path.join(unzipDestination, 'second-file.txt')), true);
    });

    it('throws when configured size limits are invalid', async function () {
        await createZipWithEntries(zipDestination, [{ name: 'file.txt', content: '123' }]);

        const invalidValues = [-1, 1.5, Number.NaN, '100'];
        const invalidLimits = [
            ['limits.perEntryUncompressedBytes', 'perEntryUncompressedBytes'],
            ['limits.totalUncompressedBytes', 'totalUncompressedBytes'],
        ].flatMap(([fieldName, limitName]) => {
            return invalidValues.map((value) => [fieldName, value, { [limitName]: value }]);
        });

        for (const [fieldName, value, limits] of invalidLimits) {
            await assert.rejects(
                () => extract(zipDestination, unzipDestination, { limits }),
                (err) => {
                    assert.equal(err.errorType, 'IncorrectUsageError');
                    assert.equal(
                        err.message,
                        `${fieldName} must be a non-negative integer or Infinity`,
                    );
                    assert.equal(err.context, 'Invalid zip extraction limit.');
                    assert.equal(err.code, 'INVALID_ZIP_LIMIT');
                    assert.deepEqual(err.errorDetails, {
                        fieldName,
                        value,
                    });
                    return true;
                },
            );
        }
    });
});
