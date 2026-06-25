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

    const extract = require('extract-zip');

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

        // Normalize permissions last, immediately before extract-zip writes the
        // entry. Do not add async work here: extract-zip does not await onEntry.
        if (shouldEnsureOwnerPermissions) {
            ensureOwnerPermissions(entry, opts);
        }
    };

    await extract(zipToExtract, opts);

    return { path: destination };
};
