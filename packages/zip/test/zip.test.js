const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');
const yauzl = require('yauzl');
const yazl = require('yazl');
const ensureOwnerPermissions = require('../lib/ensure-owner-permissions');

// Mimic how we expect this to be required
const { compress, extract } = require('../');

// Builds a zip fixture with yazl. Each entry is `{name, content}` for a file,
// `{name, type: 'directory'}` for a directory or `{name, type: 'symlink', target}`
// for a symlink, and may carry an explicit `mode` (e.g. a read-only `0o555`
// directory) and `compress: false` to store it uncompressed.
function createZipWithEntries(zipPath, entries) {
    return new Promise((resolve, reject) => {
        const zipfile = new yazl.ZipFile();
        const output = fs.createWriteStream(zipPath);

        zipfile.on('error', reject);
        output.on('error', reject);
        output.on('close', resolve);
        zipfile.outputStream.pipe(output);

        for (const entry of entries) {
            const options = {};

            if (typeof entry.mode === 'number') {
                options.mode = entry.mode;
            }

            if (entry.type === 'directory') {
                zipfile.addEmptyDirectory(entry.name, options);
            } else if (entry.type === 'symlink') {
                options.mode = 0o120777;
                zipfile.addBuffer(Buffer.from(entry.target), entry.name, options);
            } else {
                if (entry.compress === false) {
                    options.compress = false;
                }

                zipfile.addBuffer(Buffer.from(entry.content), entry.name, options);
            }
        }

        zipfile.end();
    });
}

// Returns a sorted list of `relative/path:sha256` entries for every file under
// root, so two directory trees can be compared for identical structure and content.
function hashTree(root) {
    return fs
        .readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
            const fullPath = path.join(entry.parentPath, entry.name);
            const relativePath = path.relative(root, fullPath).split(path.sep).join('/');
            const hash = crypto
                .createHash('sha256')
                .update(fs.readFileSync(fullPath))
                .digest('hex');
            return `${relativePath}:${hash}`;
        })
        .sort();
}

// Lists a zip's entries as {fileName: mode} using the POSIX mode bits.
async function listZipEntries(zipPath) {
    const zipfile = await yauzl.openPromise(zipPath);
    const entries = {};

    for await (const entry of zipfile.eachEntry()) {
        entries[entry.fileName] = (entry.externalFileAttributes >>> 16) & 0xffff;
    }

    return entries;
}

// Reads the permission bits (lowest 9 bits) of a path's mode.
function permissionBits(targetPath) {
    return fs.statSync(targetPath).mode & 0o777;
}

// Rewrite every central-directory header's uncompressedSize field to simulate
// a zip whose declared metadata understates the real payload.
function forgeCentralUncompressedSize(zipPath, fake) {
    const buf = fs.readFileSync(zipPath);
    for (let i = 0; i < buf.length - 4; i++) {
        if (buf.readUInt32LE(i) === 0x02014b50) {
            buf.writeUInt32LE(fake, i + 24);
        }
    }
    fs.writeFileSync(zipPath, buf);
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

        const originalTree = hashTree(fs.realpathSync(symlinkPath));
        assert.ok(originalTree.length > 0);

        const compressRes = await compress(symlinkPath, zipDestination);
        assert.equal(typeof compressRes, 'object');
        assert.equal(compressRes.path, zipDestination);
        assert.equal(compressRes.size < 619618, true);

        const extractRes = await extract(zipDestination, unzipDestination);
        assert.equal(typeof extractRes, 'object');
        assert.equal(extractRes.path, unzipDestination);

        assert.deepEqual(hashTree(unzipDestination), originalTree);
    });

    it('rejects when the zip writer emits an error', async function () {
        const endSpy = vi.spyOn(yazl.ZipFile.prototype, 'end').mockImplementation(function () {
            setImmediate(() => this.emit('error', new Error('archive failed')));
        });

        try {
            await assert.rejects(() => compress(themeFolder, zipDestination), /archive failed/);
        } finally {
            endSpy.mockRestore();
        }
    });

    it('rejects when the destination cannot be written', async function () {
        const missingDir = path.join(__dirname, 'fixtures', 'does-not-exist', 'theme.zip');

        await assert.rejects(() => compress(themeFolder, missingDir), { code: 'ENOENT' });
    });
});

describe('Compress folder contents', function () {
    let sourceFolder, zipDestination;

    beforeEach(function () {
        sourceFolder = fs.mkdtempSync(path.join(__dirname, 'fixtures', 'compress-src-'));
        zipDestination = `${sourceFolder}.zip`;

        fs.mkdirSync(path.join(sourceFolder, 'node_modules', 'dep'), { recursive: true });
        fs.writeFileSync(path.join(sourceFolder, 'node_modules', 'dep', 'index.js'), 'dep');
        fs.mkdirSync(path.join(sourceFolder, 'nested', 'node_modules'), { recursive: true });
        fs.writeFileSync(path.join(sourceFolder, 'nested', 'node_modules', 'keep.js'), 'keep');
        fs.mkdirSync(path.join(sourceFolder, 'empty-dir'));
        fs.mkdirSync(path.join(sourceFolder, '.hidden-dir'));
        fs.writeFileSync(path.join(sourceFolder, '.hidden-dir', 'file.txt'), 'hidden');
        fs.writeFileSync(path.join(sourceFolder, '.dotfile'), 'dot');
        fs.writeFileSync(path.join(sourceFolder, 'script.sh'), '#!/bin/sh\n', { mode: 0o755 });
        fs.chmodSync(path.join(sourceFolder, 'script.sh'), 0o755);
        fs.symlinkSync('script.sh', path.join(sourceFolder, 'link-to-script'));
    });

    afterEach(function () {
        vi.restoreAllMocks();
        fs.rmSync(sourceFolder, { recursive: true, force: true });
        fs.rmSync(zipDestination, { force: true });
    });

    it('includes dotfiles, empty directories and symlinks, and skips the top-level node_modules', async function () {
        const res = await compress(sourceFolder, zipDestination);

        assert.equal(res.path, zipDestination);
        assert.equal(res.size, fs.statSync(zipDestination).size);

        const entries = await listZipEntries(zipDestination);
        assert.deepEqual(Object.keys(entries), [
            '.dotfile',
            '.hidden-dir/',
            '.hidden-dir/file.txt',
            'empty-dir/',
            'link-to-script',
            'nested/',
            'nested/node_modules/',
            'nested/node_modules/keep.js',
            'script.sh',
        ]);

        assert.equal(entries['empty-dir/'] & 0o170000, 0o040000);
        assert.equal(entries['script.sh'] & 0o777, 0o755);
        assert.equal(entries['link-to-script'] & 0o170000, 0o120000);
    });

    it('accepts custom ignore prefixes', async function () {
        await compress(sourceFolder, zipDestination, {
            ignore: ['nested/**', '.hidden-dir/', 'link-to-script'],
        });

        const entries = await listZipEntries(zipDestination);
        assert.deepEqual(Object.keys(entries), [
            '.dotfile',
            'empty-dir/',
            'node_modules/',
            'node_modules/dep/',
            'node_modules/dep/index.js',
            'script.sh',
        ]);
    });

    it('rejects without creating the destination when an entry cannot be read', async function () {
        vi.spyOn(fs.promises, 'readlink').mockRejectedValue(new Error('readlink failed'));

        await assert.rejects(() => compress(sourceFolder, zipDestination), /readlink failed/);
        assert.equal(fs.existsSync(zipDestination), false);
    });

    it('clamps modification times before 1980 instead of crashing', async function () {
        const oldDate = new Date('1960-06-15T12:00:00Z');
        fs.utimesSync(path.join(sourceFolder, 'script.sh'), oldDate, oldDate);
        fs.utimesSync(path.join(sourceFolder, 'empty-dir'), oldDate, oldDate);

        await compress(sourceFolder, zipDestination);

        const zipfile = await yauzl.openPromise(zipDestination);
        const years = {};
        for await (const entry of zipfile.eachEntry()) {
            years[entry.fileName] = entry.getLastModDate().getFullYear();
        }

        assert.equal(years['script.sh'], 1980);
        assert.equal(years['empty-dir/'], 1980);
    });

    it('rejects and closes source streams when a source file cannot be read', async function () {
        const createReadStream = fs.createReadStream;
        vi.spyOn(fs, 'createReadStream').mockImplementation(() =>
            createReadStream(path.join(sourceFolder, 'missing-file')),
        );

        await assert.rejects(() => compress(sourceFolder, zipDestination), { code: 'ENOENT' });
        // The partly written zip is removed.
        assert.equal(fs.existsSync(zipDestination), false);
    });

    it('zips a file whose size changed after the folder was walked', async function () {
        const { Readable } = require('stream');
        const createReadStream = fs.createReadStream;
        vi.spyOn(fs, 'createReadStream').mockImplementation((filePath, ...args) => {
            if (filePath.endsWith('script.sh')) {
                return Readable.from([Buffer.from('#!/bin/sh\necho grown\n')]);
            }

            return createReadStream(filePath, ...args);
        });

        await compress(sourceFolder, zipDestination);

        const zipfile = await yauzl.openPromise(zipDestination);
        for await (const entry of zipfile.eachEntry()) {
            if (entry.fileName === 'script.sh') {
                assert.equal(entry.uncompressedSize, '#!/bin/sh\necho grown\n'.length);
            }
        }
    });

    it('never includes the destination when it is inside the folder being zipped', async function () {
        const insideDestination = path.join(sourceFolder, 'out.zip');

        await compress(sourceFolder, insideDestination);
        // Second run: out.zip now exists in the folder and must still be left out.
        await compress(sourceFolder, insideDestination);

        const entries = await listZipEntries(insideDestination);
        assert.equal('out.zip' in entries, false);
        assert.equal('script.sh' in entries, true);
    });

    it('rejects when the zip writer throws while adding entries', async function () {
        vi.spyOn(yazl.ZipFile.prototype, 'addEmptyDirectory').mockImplementation(() => {
            throw new Error('invalid entry');
        });

        await assert.rejects(() => compress(sourceFolder, zipDestination), /invalid entry/);
    });

    it('closes source streams when the destination cannot be written', async function () {
        const bigFolder = fs.mkdtempSync(path.join(__dirname, 'fixtures', 'compress-big-'));
        fs.writeFileSync(path.join(bigFolder, 'big.bin'), Buffer.alloc(4 * 1024 * 1024, 'a'));

        const streams = [];
        const createReadStream = fs.createReadStream;
        vi.spyOn(fs, 'createReadStream').mockImplementation((...args) => {
            const stream = createReadStream(...args);
            streams.push(stream);
            return stream;
        });

        try {
            const missingDir = path.join(bigFolder, 'does-not-exist', 'out.zip');
            await assert.rejects(() => compress(bigFolder, missingDir), { code: 'ENOENT' });

            assert.equal(streams.length, 1);
            assert.equal(streams[0].destroyed, true);
        } finally {
            fs.rmSync(bigFolder, { recursive: true, force: true });
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
        fs.rmSync(zipDestination, { recursive: true, force: true });
        fs.rmSync(unzipDestination, { recursive: true, force: true });
        fs.rmSync(symLinkPath, { recursive: true, force: true });
        if (longFilePath) {
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
        await createZipWithEntries(zipDestination, [
            { name: 'themes/test-target', type: 'symlink', target: 'symlink-entry' },
        ]);

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

    function mockYauzlSingleEntry(entry) {
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === 'yauzl') {
                return {
                    async openPromise() {
                        return {
                            async *eachEntry() {
                                yield entry;
                            },
                        };
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
        // Trailing slash → treated as directory, so we don't need a mock openReadStream.
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

    it('rejects a zip whose central directory understates an entry size', async function () {
        // The declared-size check sees a tiny size and lets it through; yauzl's
        // entry size validation sees the real 1 MB payload and rejects.
        await createZipWithEntries(zipDestination, [
            { name: 'lying.txt', content: Buffer.alloc(1024 * 1024, 'a') },
        ]);
        forgeCentralUncompressedSize(zipDestination, 5);

        await assert.rejects(
            () =>
                extract(zipDestination, unzipDestination, {
                    limits: { perEntryUncompressedBytes: 100 },
                }),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(err.code, 'INVALID_ENTRY_SIZE');
                assert.deepEqual(err.errorDetails, {
                    entryName: 'lying.txt',
                    declaredBytes: 5,
                });
                return true;
            },
        );
    });

    it('rejects a zip whose central directory overstates an entry size', async function () {
        await createZipWithEntries(zipDestination, [{ name: 'short.txt', content: '12345' }]);
        forgeCentralUncompressedSize(zipDestination, 50);

        await assert.rejects(
            () => extract(zipDestination, unzipDestination),
            (err) => {
                assert.equal(err.code, 'INVALID_ENTRY_SIZE');
                assert.deepEqual(err.errorDetails, {
                    entryName: 'short.txt',
                    declaredBytes: 50,
                });
                return true;
            },
        );
    });

    it('rejects a zip whose stored entry declares a mismatched uncompressed size', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'stored.txt', content: '12345', compress: false },
        ]);
        forgeCentralUncompressedSize(zipDestination, 50);

        await assert.rejects(
            () => extract(zipDestination, unzipDestination),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(err.code, 'INVALID_ENTRY_SIZE');
                assert.equal(err.errorDetails, undefined);
                return true;
            },
        );
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

describe('Extract zip with ensureOwnerPermissions', function () {
    let zipDestination, unzipDestination;

    beforeAll(function () {
        zipDestination = path.join(__dirname, 'fixtures', 'perms-theme.zip');
        unzipDestination = path.join(__dirname, 'fixtures', 'perms-theme-unzipped');
    });

    afterEach(function () {
        if (fs.existsSync(zipDestination)) {
            fs.rmSync(zipDestination, { recursive: true, force: true });
        }

        if (fs.existsSync(unzipDestination)) {
            // chmod the tree back to writable first so a read-only directory left
            // behind by a default-mode extraction can still be removed.
            for (const entry of fs.readdirSync(unzipDestination, { recursive: true })) {
                fs.chmodSync(path.join(unzipDestination, entry), 0o755);
            }

            fs.rmSync(unzipDestination, { recursive: true, force: true });
        }
    });

    it('does not change the mode of the extraction root for a ./ entry', async function () {
        await createZipWithEntries(zipDestination, [
            { name: './', type: 'directory', mode: 0o777 },
            { name: 'file.txt', content: 'x' },
        ]);
        fs.mkdirSync(unzipDestination, { mode: 0o700 });
        fs.chmodSync(unzipDestination, 0o700);

        await extract(zipDestination, unzipDestination);

        assert.equal(permissionBits(unzipDestination), 0o700);
        assert.equal(fs.existsSync(path.join(unzipDestination, 'file.txt')), true);
    });

    it('applies the process umask to directory entry modes', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'open-dir/', type: 'directory', mode: 0o777 },
        ]);

        await extract(zipDestination, unzipDestination);

        const umask = process.umask();
        assert.equal(permissionBits(path.join(unzipDestination, 'open-dir')), 0o777 & ~umask);
    });

    it('preserves default read-only directory permissions when the option is omitted', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'readonly-dir/', type: 'directory', mode: 0o555 },
        ]);

        await extract(zipDestination, unzipDestination);

        const dirPath = path.join(unzipDestination, 'readonly-dir');
        assert.equal(fs.existsSync(dirPath), true);
        // Default behaviour is unchanged: the owner write bit is not added.
        assert.equal(permissionBits(dirPath) & 0o200, 0);
    });

    it('extracts an archive with a read-only directory and read-only files', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'readonly-dir/', type: 'directory', mode: 0o555 },
            { name: 'readonly-dir/nested.txt', content: 'nested content', mode: 0o444 },
            { name: 'readonly-file.txt', content: 'top-level content', mode: 0o444 },
            { name: 'writable-file.txt', content: 'already writable', mode: 0o644 },
        ]);

        await extract(zipDestination, unzipDestination, { ensureOwnerPermissions: true });

        const dirPath = path.join(unzipDestination, 'readonly-dir');
        const nestedPath = path.join(dirPath, 'nested.txt');
        const filePath = path.join(unzipDestination, 'readonly-file.txt');
        const writablePath = path.join(unzipDestination, 'writable-file.txt');

        // The directory gains owner rwx so the nested file can be written into it.
        assert.equal((permissionBits(dirPath) & 0o700) === 0o700, true);
        // Existing group/world read+execute bits are preserved.
        assert.equal(permissionBits(dirPath) & 0o055, 0o055);

        // The nested file is extracted and readable.
        assert.equal(fs.readFileSync(nestedPath, 'utf8'), 'nested content');

        // Read-only files gain owner write while keeping group/world read.
        assert.equal(permissionBits(filePath) & 0o600, 0o600);
        assert.equal(permissionBits(filePath) & 0o044, 0o044);
        assert.equal(fs.readFileSync(filePath, 'utf8'), 'top-level content');

        // Files that already grant owner write are left untouched.
        assert.equal(permissionBits(writablePath), 0o644);
        assert.equal(fs.readFileSync(writablePath, 'utf8'), 'already writable');
    });

    it('keeps execute bits on executable files while adding owner write', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'script.sh', content: '#!/bin/sh\necho hi\n', mode: 0o555 },
        ]);

        await extract(zipDestination, unzipDestination, { ensureOwnerPermissions: true });

        const scriptPath = path.join(unzipDestination, 'script.sh');
        const bits = permissionBits(scriptPath);

        // Owner gains write...
        assert.equal(bits & 0o200, 0o200);
        // ...without losing any of the original r-xr-xr-x execute/read bits.
        assert.equal(bits & 0o555, 0o555);
    });

    it('still rejects symlink entries when ensureOwnerPermissions is enabled', async function () {
        await createZipWithEntries(zipDestination, [
            { name: 'themes/test-target', type: 'symlink', target: 'symlink-entry' },
        ]);

        await assert.rejects(
            () =>
                extract(zipDestination, unzipDestination, {
                    ensureOwnerPermissions: true,
                }),
            (err) => {
                assert.equal(err.errorType, 'UnsupportedMediaTypeError');
                assert.equal(err.message, 'Symlinks are not allowed in the zip folder.');
                assert.equal(err.code, 'SYMLINK_NOT_ALLOWED');
                assert.deepEqual(err.errorDetails, {
                    entryName: 'themes/test-target',
                });
                return true;
            },
        );
    });
});

describe('ensureOwnerPermissions', function () {
    it('sets the directory type bit on inferred directories that lack POSIX type bits', function () {
        // A directory recognised only by its trailing slash, carrying 0o555
        // permission bits but no POSIX directory type bit, plus a low DOS bit.
        const entry = {
            fileName: 'inferred-dir/',
            externalFileAttributes: (((0o555 << 16) >>> 0) | 0x10) >>> 0,
            versionMadeBy: 0x0300, // unix host, so the Windows directory rule does not apply
        };

        ensureOwnerPermissions(entry);

        const mode = (entry.externalFileAttributes >> 16) & 0xffff;
        // The directory type bit is now present...
        assert.equal(mode & 0o170000, 0o040000);
        // ...owner gains rwx while the original r-x bits are preserved.
        assert.equal(mode & 0o777, 0o755);
        // Low DOS attribute bits are preserved.
        assert.equal(entry.externalFileAttributes & 0xffff, 0x10);
    });

    it('leaves entries without POSIX mode bits untouched when defaults already grant owner access', function () {
        // No POSIX mode bits and no custom defaults: extractZip() applies its own
        // owner-accessible defaults (0o755/0o644), so the entry is left as-is.
        const entry = { fileName: 'no-mode.txt', externalFileAttributes: 0 };

        ensureOwnerPermissions(entry);

        assert.equal(entry.externalFileAttributes, 0);
    });

    it('guarantees owner permissions for zero-mode entries even when defaultDirMode/defaultFileMode omit them', function () {
        // Zero-mode entries (e.g. Windows / no-POSIX archives) whose mode would
        // otherwise be synthesised from owner-less caller defaults.
        const dirEntry = { fileName: 'win-dir/', externalFileAttributes: 0, versionMadeBy: 0 };
        const fileEntry = { fileName: 'win-file.txt', externalFileAttributes: 0, versionMadeBy: 0 };
        const opts = { defaultDirMode: 0o555, defaultFileMode: 0o444 };

        ensureOwnerPermissions(dirEntry, opts);
        ensureOwnerPermissions(fileEntry, opts);

        const dirMode = (dirEntry.externalFileAttributes >> 16) & 0xffff;
        const fileMode = (fileEntry.externalFileAttributes >> 16) & 0xffff;

        // Directory: owner rwx is guaranteed, the default r-x bits are preserved,
        // and the POSIX directory type bit is set.
        assert.equal(dirMode & 0o700, 0o700);
        assert.equal(dirMode & 0o055, 0o055);
        assert.equal(dirMode & 0o170000, 0o040000);

        // File: owner rw is guaranteed while the default read bits are preserved.
        assert.equal(fileMode & 0o600, 0o600);
        assert.equal(fileMode & 0o044, 0o044);
    });

    it('normalizes a zero-mode directory to the owner-accessible default when no defaults are supplied', function () {
        // A Windows-style directory entry with no POSIX mode bits and no caller
        // defaults: extractZip() would fall back to 0o755, which already grants
        // owner rwx, but we still stamp the directory type bit so it round-trips.
        const dirEntry = { fileName: 'win-dir/', externalFileAttributes: 0, versionMadeBy: 0 };

        ensureOwnerPermissions(dirEntry);

        const dirMode = (dirEntry.externalFileAttributes >> 16) & 0xffff;
        assert.equal(dirMode & 0o170000, 0o040000);
        assert.equal(dirMode & 0o777, 0o755);
    });

    it('recognizes a directory via the Windows directory attribute (no trailing slash)', function () {
        // No POSIX type bit and no trailing slash: detected as a directory only
        // by the Windows directory attribute (externalFileAttributes === 16,
        // versionMadeBy host byte === 0).
        const dirEntry = { fileName: 'win-dir', externalFileAttributes: 16, versionMadeBy: 0 };

        ensureOwnerPermissions(dirEntry);

        const dirMode = (dirEntry.externalFileAttributes >> 16) & 0xffff;
        // Treated as a directory: type bit set and owner rwx guaranteed.
        assert.equal(dirMode & 0o170000, 0o040000);
        assert.equal(dirMode & 0o700, 0o700);
    });
});
