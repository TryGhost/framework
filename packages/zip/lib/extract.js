const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const errors = require('@tryghost/errors');
const { S_IFMT, S_IFLNK, getEntryMode } = require('./entry-mode');
const ensureOwnerPermissions = require('./ensure-owner-permissions');

const defaultOptions = {};

function normalizeLimit(value, fieldName) {
    if (value === undefined || value === null || value === Infinity) {
        return Infinity;
    }

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new errors.IncorrectUsageError({
            message: `${fieldName} must be a non-negative integer or Infinity`,
            context: 'Invalid zip extraction limit.',
            code: 'INVALID_ZIP_LIMIT',
            errorDetails: {
                fieldName,
                value,
            },
        });
    }

    return value;
}

function getLimits(options) {
    const limits = options.limits || {};

    return {
        perEntryUncompressedBytes: normalizeLimit(
            limits.perEntryUncompressedBytes,
            'limits.perEntryUncompressedBytes',
        ),
        totalUncompressedBytes: normalizeLimit(
            limits.totalUncompressedBytes,
            'limits.totalUncompressedBytes',
        ),
    };
}

function hasSizeLimits(limits) {
    return (
        limits.perEntryUncompressedBytes !== Infinity || limits.totalUncompressedBytes !== Infinity
    );
}

function getEntryUncompressedSize(entry, limits) {
    if (
        !hasSizeLimits(limits) &&
        (entry.uncompressedSize === undefined || entry.uncompressedSize === null)
    ) {
        return 0;
    }

    if (
        typeof entry.uncompressedSize !== 'number' ||
        !Number.isInteger(entry.uncompressedSize) ||
        entry.uncompressedSize < 0
    ) {
        throw new errors.UnsupportedMediaTypeError({
            message: 'Zip entry has invalid uncompressed size.',
            context: 'The zip contains an entry with invalid uncompressed size metadata.',
            code: 'INVALID_ENTRY_SIZE',
            errorDetails: {
                entryName: entry.fileName,
                observedBytes: entry.uncompressedSize,
            },
        });
    }

    return entry.uncompressedSize;
}

function throwOnEntryTooLarge(entry, observedBytes, limitBytes) {
    if (observedBytes <= limitBytes) {
        return;
    }

    throw new errors.UnsupportedMediaTypeError({
        message: 'Zip entry exceeds maximum uncompressed size.',
        context: 'The zip contains an entry that exceeds the maximum uncompressed size.',
        code: 'ENTRY_TOO_LARGE',
        errorDetails: {
            entryName: entry.fileName,
            observedBytes,
            limitBytes,
        },
    });
}

function throwOnTotalTooLarge(entry, observedBytes, limitBytes, entriesProcessed) {
    if (observedBytes <= limitBytes) {
        return;
    }

    throw new errors.UnsupportedMediaTypeError({
        message: 'Zip exceeds maximum total uncompressed size.',
        context: 'The zip exceeds the maximum total uncompressed size.',
        code: 'TOTAL_TOO_LARGE',
        errorDetails: {
            entryName: entry.fileName,
            observedBytes,
            limitBytes,
            entriesProcessed,
        },
    });
}

function throwOnSymlinks(entry) {
    // Check if symlink (using stat mode constants)
    const mode = getEntryMode(entry);
    const symlink = (mode & S_IFMT) === S_IFLNK;

    if (symlink) {
        throw new errors.UnsupportedMediaTypeError({
            message: 'Symlinks are not allowed in the zip folder.',
            context: 'The zip contains a symlink entry.',
            code: 'SYMLINK_NOT_ALLOWED',
            errorDetails: {
                entryName: entry.fileName,
            },
        });
    }
}

function throwOnLargeFilenames(entry) {
    const filenameBytes = Buffer.byteLength(entry.fileName, 'utf8');

    if (filenameBytes >= 254) {
        throw new errors.UnsupportedMediaTypeError({
            message: 'File names in the zip folder must be shorter than 254 characters.',
            context: 'The zip contains a filename that is too long.',
            code: 'FILENAME_TOO_LONG',
            errorDetails: {
                entryName: entry.fileName,
                observedBytes: filenameBytes,
                limitBytes: 254,
            },
        });
    }
}

/**
 * Extract
 *
 * - Unzip an archive to a folder
 *
 * @param {String} zipToExtract - full path to zip file that should be extracted
 * @param {String} destination - full path of the extraction target
 * @param {Object} [options]
 * @param {Integer} [options.defaultDirMode] - Directory Mode (permissions), defaults to 0o755
 * @param {Integer} [options.defaultFileMode] - File Mode (permissions), defaults to 0o644
 * @param {Function} [options.onEntry] - if present, will be called with (entry, zipfile) for every entry in the zip
 * @param {Object} [options.limits] - if present, sets maximum uncompressed sizes
 * @param {Integer} [options.limits.perEntryUncompressedBytes] - maximum uncompressed size of each entry
 * @param {Integer} [options.limits.totalUncompressedBytes] - maximum total uncompressed size across all entries
 * @param {Boolean} [options.ensureOwnerPermissions] - when true, normalizes extracted entry permissions so the
 *   owner can always read/move/remove the result: directories gain at least owner rwx and files at least owner rw,
 *   while existing execute/group/world bits are preserved. The source zip is never modified. Defaults to false.
 *   Intended for trusted temporary extraction of user-supplied archives (e.g. theme zips with read-only directories).
 */
module.exports = async (zipToExtract, destination, options) => {
    const opts = Object.assign({}, defaultOptions, options);
    const limits = getLimits(opts);
    let totalUncompressedBytes = 0;
    let entriesProcessed = 0;

    opts.dir = destination;

    const shouldEnsureOwnerPermissions = opts.ensureOwnerPermissions === true;
    const originalOnEntry = opts.onEntry;
    opts.onEntry = (entry, zipfile) => {
        const entryUncompressedBytes = getEntryUncompressedSize(entry, limits);

        throwOnEntryTooLarge(entry, entryUncompressedBytes, limits.perEntryUncompressedBytes);

        totalUncompressedBytes += entryUncompressedBytes;
        entriesProcessed += 1;

        throwOnTotalTooLarge(
            entry,
            totalUncompressedBytes,
            limits.totalUncompressedBytes,
            entriesProcessed,
        );

        throwOnSymlinks(entry);
        throwOnLargeFilenames(entry);
        if (originalOnEntry) {
            originalOnEntry(entry, zipfile);
        }

        // Normalize permissions last, immediately before extractZip() writes the
        // entry. Do not add async work here: extractZip() does not await onEntry.
        if (shouldEnsureOwnerPermissions) {
            ensureOwnerPermissions(entry, opts);
        }
    };

    await extractZip(zipToExtract, opts);

    return { path: destination };
};

// yauzl's entry size validation rejects an entry whose actual data does not
// match its declared `uncompressedSize` with one of these messages.
const ENTRY_SIZE_MISMATCH = /^(too many|not enough) bytes in the stream\b/;

// Minimal yauzl-based replacement for extract-zip, which is unmaintained (no
// release since 2020).
//
// yauzl's default `validateEntrySizes` guarantees an entry never yields more
// bytes than its declared `uncompressedSize`, so the declared-size checks in
// `onEntry` also bound the bytes actually written to disk.
async function extractZip(zipPath, opts) {
    const yauzl = require('yauzl');
    await fs.promises.mkdir(opts.dir, { recursive: true });
    const dir = await fs.promises.realpath(opts.dir);

    const zipfile = await new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, z) => {
            if (err) return reject(err);
            resolve(z);
        });
    });

    try {
        await new Promise((resolve, reject) => {
            let settled = false;
            const fail = (err) => {
                if (settled) return;
                settled = true;
                reject(err);
            };

            zipfile.on('error', fail);
            zipfile.on('end', () => {
                if (settled) return;
                settled = true;
                resolve();
            });
            zipfile.on('entry', (entry) => {
                if (settled) return;
                extractEntry(entry, zipfile, opts, dir)
                    .then(() => settled || zipfile.readEntry())
                    .catch(fail);
            });

            zipfile.readEntry();
        });
    } finally {
        try {
            zipfile.close();
        } catch {
            // best-effort
        }
    }
}

async function extractEntry(entry, zipfile, opts, dir) {
    // Skip macOS resource-fork entries — extract-zip did the same.
    if (entry.fileName.startsWith('__MACOSX/')) return;

    // Existing pre-flight checks (size, symlinks, filename length, onEntry hook).
    opts.onEntry(entry, zipfile);

    // Stat the entry: mode bits, directory marker, filesystem-mode resolution.
    // Mirrors extract-zip's logic verbatim so behaviour is preserved.
    const rawMode = (entry.externalFileAttributes >> 16) & 0xffff;
    const IFMT = 61440;
    const IFDIR = 16384;
    const isDir =
        (rawMode & IFMT) === IFDIR ||
        entry.fileName.endsWith('/') ||
        (entry.versionMadeBy >> 8 === 0 && entry.externalFileAttributes === 16);
    const defaultMode = isDir
        ? (opts.defaultDirMode && parseInt(opts.defaultDirMode, 10)) || 0o755
        : (opts.defaultFileMode && parseInt(opts.defaultFileMode, 10)) || 0o644;
    const mode = (rawMode === 0 ? defaultMode : rawMode) & 0o777;

    // Path-traversal guard — port of extract-zip's realpath/relative check.
    const entryPath = path.join(dir, entry.fileName);
    const containerDir = isDir ? entryPath : path.dirname(entryPath);
    await fs.promises.mkdir(containerDir, { recursive: true });
    const canonicalContainerDir = await fs.promises.realpath(containerDir);
    if (path.relative(dir, canonicalContainerDir).split(path.sep).includes('..')) {
        throw new Error(
            `Out of bound path "${canonicalContainerDir}" found while processing file ${entry.fileName}`,
        );
    }

    if (isDir) {
        await fs.promises.chmod(entryPath, mode).catch(() => {});
        return;
    }

    const readStream = await new Promise((resolve, reject) => {
        zipfile.openReadStream(entry, (err, s) => (err ? reject(err) : resolve(s)));
    });

    try {
        await pipeline(readStream, fs.createWriteStream(entryPath, { mode }));
    } catch (err) {
        if (!ENTRY_SIZE_MISMATCH.test(err.message)) {
            throw err;
        }

        throw new errors.UnsupportedMediaTypeError({
            message: 'Zip entry data does not match its declared uncompressed size.',
            context: 'The zip contains an entry with invalid uncompressed size metadata.',
            code: 'INVALID_ENTRY_SIZE',
            errorDetails: {
                entryName: entry.fileName,
                declaredBytes: entry.uncompressedSize,
            },
            err,
        });
    }
}
