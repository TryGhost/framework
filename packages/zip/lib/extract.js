const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pipeline, Transform } = require('stream');
const errors = require('@tryghost/errors');

const pipelineAsync = promisify(pipeline);

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

function entryTooLargeError(entry, observedBytes, limitBytes) {
    return new errors.UnsupportedMediaTypeError({
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

function totalTooLargeError(entry, observedBytes, limitBytes, entriesProcessed) {
    return new errors.UnsupportedMediaTypeError({
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

function throwOnEntryTooLarge(entry, observedBytes, limitBytes) {
    if (observedBytes > limitBytes) {
        throw entryTooLargeError(entry, observedBytes, limitBytes);
    }
}

function throwOnTotalTooLarge(entry, observedBytes, limitBytes, entriesProcessed) {
    if (observedBytes > limitBytes) {
        throw totalTooLargeError(entry, observedBytes, limitBytes, entriesProcessed);
    }
}

function throwOnSymlinks(entry) {
    // Check if symlink
    const mode = (entry.externalFileAttributes >> 16) & 0xffff;
    // check if it's a symlink or dir (using stat mode constants)
    const IFMT = 61440;
    const IFLNK = 40960;
    const symlink = (mode & IFMT) === IFLNK;

    if (symlink) {
        throw new errors.UnsupportedMediaTypeError({
            message: 'Symlinks are not allowed in the zip folder.',
        });
    }
}

function throwOnLargeFilenames(entry) {
    if (Buffer.byteLength(entry.fileName, 'utf8') >= 254) {
        throw new errors.UnsupportedMediaTypeError({
            message: 'File names in the zip folder must be shorter than 254 characters.',
        });
    }
}

// Ported from extract-zip: decide whether an entry is a directory.
function isDirectoryEntry(entry) {
    const mode = (entry.externalFileAttributes >> 16) & 0xffff;
    const IFMT = 61440;
    const IFDIR = 16384;

    if ((mode & IFMT) === IFDIR) {
        return true;
    }

    if (entry.fileName.endsWith('/')) {
        return true;
    }

    // Windows-only marker — DOS-mode 16 means "directory" when madeBy is DOS (0).
    // See https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
    const madeBy = entry.versionMadeBy >> 8;
    if (madeBy === 0 && entry.externalFileAttributes === 16) {
        return true;
    }

    return false;
}

// Ported from extract-zip: resolve the filesystem mode bits to apply to an entry.
function getEntryMode(entry, opts, isDir) {
    let mode = (entry.externalFileAttributes >> 16) & 0xffff;

    if (mode === 0) {
        if (isDir) {
            mode = opts.defaultDirMode ? parseInt(opts.defaultDirMode, 10) : 0o755;
        } else {
            mode = opts.defaultFileMode ? parseInt(opts.defaultFileMode, 10) : 0o644;
        }
    }

    return mode & 0o777;
}

// Streaming byte counter — enforces per-entry and total limits against actual
// decompressed bytes, not the declared central-directory metadata. This is the
// real zip-bomb defence: a forged uncompressedSize gets past the pre-flight
// metadata check, but the actual decompressed bytes can't slip past this.
class StreamingCounter extends Transform {
    constructor({ entry, perEntryLimit, onBytes }) {
        super();
        this.entry = entry;
        this.perEntryLimit = perEntryLimit;
        this.entryBytes = 0;
        this.onBytes = onBytes;
    }

    _transform(chunk, _encoding, cb) {
        this.entryBytes += chunk.length;
        if (this.entryBytes > this.perEntryLimit) {
            return cb(entryTooLargeError(this.entry, this.entryBytes, this.perEntryLimit));
        }
        try {
            this.onBytes(chunk.length);
        } catch (err) {
            return cb(err);
        }
        cb(null, chunk);
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
 * @param {Integer} options.defaultDirMode - Directory Mode (permissions), defaults to 0o755
 * @param {Integer} options.defaultFileMode - File Mode (permissions), defaults to 0o644
 * @param {Function} options.onEntry - if present, will be called with (entry, zipfile) for every entry in the zip
 * @param {Object} [options.limits] - if present, sets maximum uncompressed sizes
 * @param {Integer} options.limits.perEntryUncompressedBytes - maximum uncompressed size of each entry
 * @param {Integer} options.limits.totalUncompressedBytes - maximum total uncompressed size across all entries
 */
module.exports = async (zipToExtract, destination, options) => {
    const opts = Object.assign({}, defaultOptions, options);
    const limits = getLimits(opts);
    let totalActualBytes = 0;
    let entriesProcessed = 0;

    // Lazy require so tests can swap yauzl out via Module._load before each call.
    const yauzl = require('yauzl');
    const openZip = promisify(yauzl.open);

    await fs.promises.mkdir(destination, { recursive: true });
    const dir = await fs.promises.realpath(destination);

    // `validateEntrySizes: false` disables yauzl's built-in AssertByteCountStream
    // because it overrides the stream's `destroy` in a way that silently swallows
    // mid-stream errors and leaves any downstream pipeline waiting forever. We
    // enforce sizes ourselves below via StreamingCounter, which propagates errors
    // through the pipeline cleanly.
    const zipfile = await openZip(zipToExtract, {
        lazyEntries: true,
        validateEntrySizes: false,
    });

    let settled = false;

    try {
        await new Promise((resolve, reject) => {
            zipfile.on('error', (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(err);
            });

            zipfile.on('end', () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            });

            zipfile.on('entry', (entry) => {
                if (settled) {
                    return;
                }

                Promise.resolve()
                    .then(() =>
                        processEntry(entry, zipfile, opts, limits, dir, {
                            addTotal: (n) => {
                                totalActualBytes += n;
                                throwOnTotalTooLarge(
                                    entry,
                                    totalActualBytes,
                                    limits.totalUncompressedBytes,
                                    entriesProcessed,
                                );
                            },
                            markProcessed: () => {
                                entriesProcessed += 1;
                            },
                        }),
                    )
                    .then(() => {
                        if (!settled) {
                            zipfile.readEntry();
                        }
                    })
                    .catch((err) => {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        reject(err);
                    });
            });

            zipfile.readEntry();
        });
    } finally {
        try {
            zipfile.close();
        } catch {
            // best-effort close
        }
    }

    return { path: destination };
};

async function processEntry(entry, zipfile, opts, limits, dir, { addTotal, markProcessed }) {
    // Skip macOS resource-fork entries — they never round-trip cleanly and are noise.
    if (entry.fileName.startsWith('__MACOSX/')) {
        return;
    }

    // Pre-flight metadata check: cheap rejection of zips that honestly declare
    // themselves too large, before we touch the read stream. The streaming
    // counter below catches archives that lie about their declared size.
    const declaredBytes = getEntryUncompressedSize(entry, limits);
    throwOnEntryTooLarge(entry, declaredBytes, limits.perEntryUncompressedBytes);

    markProcessed();

    throwOnSymlinks(entry);
    throwOnLargeFilenames(entry);
    if (opts.onEntry) {
        opts.onEntry(entry, zipfile);
    }

    const entryPath = path.join(dir, entry.fileName);
    const isDir = isDirectoryEntry(entry);
    const mode = getEntryMode(entry, opts, isDir);
    const containerDir = isDir ? entryPath : path.dirname(entryPath);

    await fs.promises.mkdir(containerDir, { recursive: true });

    // Path-traversal guard: after mkdir, resolve the actual on-disk path and
    // make sure it stays within `dir`. Catches both `../` shenanigans and
    // symlink-target shenanigans created in earlier entries of the same zip.
    const canonicalContainerDir = await fs.promises.realpath(containerDir);
    const relative = path.relative(dir, canonicalContainerDir);
    if (relative.split(path.sep).includes('..')) {
        throw new Error(
            `Out of bound path "${canonicalContainerDir}" found while processing file ${entry.fileName}`,
        );
    }

    if (isDir) {
        // Apply requested mode to the directory we just created.
        await fs.promises.chmod(entryPath, mode).catch(() => {});
        // Account declared bytes against the total — directories typically declare
        // 0, but preserve the pre-existing behaviour of including them in the count.
        addTotal(declaredBytes);
        return;
    }

    const openReadStream = promisify(zipfile.openReadStream.bind(zipfile));
    const readStream = await openReadStream(entry);
    const writeStream = fs.createWriteStream(entryPath, { mode });

    const counter = new StreamingCounter({
        entry,
        perEntryLimit: limits.perEntryUncompressedBytes,
        onBytes: addTotal,
    });

    await pipelineAsync(readStream, counter, writeStream);
}
