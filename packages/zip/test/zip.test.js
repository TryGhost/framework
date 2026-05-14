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

// Patches every central-directory file-header's uncompressedSize field (offset +24)
// to make the zip lie about its actual decompressed size. Used to simulate
// zip-bomb-style archives whose declared metadata is smaller than the real payload.
function forgeCentralUncompressedSize(zipPath, fake) {
    const buf = fs.readFileSync(zipPath);
    const CENTRAL_DIR_SIG = 0x02014b50;
    let patched = 0;
    for (let i = 0; i < buf.length - 4; i++) {
        if (buf.readUInt32LE(i) === CENTRAL_DIR_SIG) {
            buf.writeUInt32LE(fake, i + 24);
            patched += 1;
        }
    }
    fs.writeFileSync(zipPath, buf);
    return patched;
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
            /File names in the zip folder must be shorter than 254 characters\./,
        );
    });

    it('throws when the zip contains symlink entries', async function () {
        await createZip(zipDestination, (archive) => {
            archive.symlink('themes/test-target', 'symlink-entry');
        });

        await assert.rejects(
            () => extract(zipDestination, unzipDestination),
            /Symlinks are not allowed in the zip folder\./,
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

    function mockYauzlSingleEntry(entry) {
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === 'yauzl') {
                return {
                    open(zipPath, opts, cb) {
                        const zipfile = new EventEmitter();
                        let entryFired = false;
                        zipfile.readEntry = () => {
                            setImmediate(() => {
                                if (!entryFired) {
                                    entryFired = true;
                                    zipfile.emit('entry', entry);
                                } else {
                                    zipfile.emit('end');
                                }
                            });
                        };
                        zipfile.close = () => {};
                        cb(null, zipfile);
                    },
                };
            }

            return originalLoad(request, parent, isMain);
        };
        return () => {
            Module._load = originalLoad;
        };
    }

    it('preserves existing behaviour for entries without uncompressed size when no limits are configured', async function () {
        // Trailing slash marks this entry as a directory, so we don't need to mock openReadStream.
        const restore = mockYauzlSingleEntry({
            fileName: 'missing-size-dir/',
            externalFileAttributes: 0,
            versionMadeBy: 0,
        });

        try {
            const result = await extract(zipDestination, unzipDestination);

            assert.equal(result.path, unzipDestination);
        } finally {
            restore();
        }
    });

    it('throws when a limited entry has no uncompressed size', async function () {
        const restore = mockYauzlSingleEntry({
            fileName: 'missing-size.txt',
            externalFileAttributes: 0,
            versionMadeBy: 0,
        });

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
            restore();
        }
    });

    it('rejects an entry whose path escapes the destination directory', async function () {
        // archiver normalizes ../ out of filenames, so we inject the malicious
        // entry name via the yauzl mock — this is the same shape an attacker
        // could ship in a hand-crafted zip.
        const restore = mockYauzlSingleEntry({
            fileName: '../escape.txt',
            externalFileAttributes: 0,
            versionMadeBy: 0,
        });

        try {
            await assert.rejects(
                () => extract(zipDestination, unzipDestination),
                (err) => {
                    assert.match(err.message, /Out of bound path/);
                    return true;
                },
            );
        } finally {
            restore();
        }
    });

    it('throws when a limited entry has a non-numeric uncompressed size', async function () {
        const restore = mockYauzlSingleEntry({
            fileName: 'invalid-size.txt',
            externalFileAttributes: 0,
            versionMadeBy: 0,
            uncompressedSize: Number.NaN,
        });

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
            restore();
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

    it('rejects a zip whose central directory lies about uncompressed size (zip-bomb defence)', async function () {
        // Build a zip with 1MB of content, then forge the central directory to declare 5 bytes.
        // Without streaming enforcement, the pre-flight metadata check would pass with a high
        // limit, and the underlying decompression would still expand the payload to disk.
        const realContent = Buffer.alloc(1024 * 1024, 'a');
        await createZipWithEntries(zipDestination, [{ name: 'lying.txt', content: realContent }]);
        const patched = forgeCentralUncompressedSize(zipDestination, 5);
        assert.equal(patched >= 1, true, 'expected to patch at least one central directory header');

        // Pre-flight metadata check sees declared=5, limit=100 — allows through.
        // Streaming counter must catch the actual size (1MB > 100) and reject cleanly.
        await assert.rejects(
            () =>
                extract(zipDestination, unzipDestination, {
                    limits: {
                        perEntryUncompressedBytes: 100,
                    },
                }),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(err.code, 'ENTRY_TOO_LARGE');
                assert.equal(err.errorDetails.entryName, 'lying.txt');
                assert.equal(err.errorDetails.limitBytes, 100);
                assert.equal(
                    err.errorDetails.observedBytes > 100,
                    true,
                    `expected observedBytes > 100 (actual streaming bytes), got ${err.errorDetails.observedBytes}`,
                );
                return true;
            },
        );
    });

    it('rejects a zip whose cumulative actual bytes exceed the total limit', async function () {
        // Two entries: each declares 5 bytes but actually contains 3KB.
        // Cumulative actual = 6KB, well over the 100-byte total limit.
        const realContent = Buffer.alloc(3 * 1024, 'b');
        await createZipWithEntries(zipDestination, [
            { name: 'first.txt', content: realContent },
            { name: 'second.txt', content: realContent },
        ]);
        forgeCentralUncompressedSize(zipDestination, 5);

        await assert.rejects(
            () =>
                extract(zipDestination, unzipDestination, {
                    limits: {
                        totalUncompressedBytes: 100,
                    },
                }),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(
                    err.code === 'TOTAL_TOO_LARGE' || err.code === 'ENTRY_TOO_LARGE',
                    true,
                    `expected TOTAL_TOO_LARGE or ENTRY_TOO_LARGE, got ${err.code}`,
                );
                return true;
            },
        );
    });

    it('extracts a lying zip when no limits are configured (no streaming enforcement)', async function () {
        // With no limits, the streaming counter has nothing to enforce; the underlying
        // decompression should write the real bytes and the call should resolve cleanly
        // (this is the previously-hanging case under extract-zip + yauzl).
        const realContent = Buffer.alloc(1024, 'a');
        await createZipWithEntries(zipDestination, [{ name: 'lying.txt', content: realContent }]);
        forgeCentralUncompressedSize(zipDestination, 5);

        await extract(zipDestination, unzipDestination);

        const extracted = path.join(unzipDestination, 'lying.txt');
        assert.equal(fs.existsSync(extracted), true);
        assert.equal(fs.statSync(extracted).size, realContent.length);
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
