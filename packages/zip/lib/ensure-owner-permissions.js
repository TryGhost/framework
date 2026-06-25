const { S_IFMT, S_IFDIR, getEntryMode } = require('./entry-mode');

// Owner permission bits we guarantee when `ensureOwnerPermissions` is enabled.
const OWNER_DIR_BITS = 0o700; // rwx, so the tree can be traversed, written and removed
const OWNER_FILE_BITS = 0o600; // rw, so files can be read and rewritten/removed

// Mirrors extract-zip's directory detection: POSIX directory type bit, a
// trailing slash, or the Windows directory attribute.
function isDirectoryEntry(entry, mode) {
    if ((mode & S_IFMT) === S_IFDIR) {
        return true;
    }

    if (entry.fileName.endsWith('/')) {
        return true;
    }

    // Windows' way of specifying a directory
    // https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
    const madeBy = entry.versionMadeBy >> 8;
    return madeBy === 0 && entry.externalFileAttributes === 16;
}

// Resolves the mode extract-zip would synthesise for an entry that carries no
// POSIX mode bits, mirroring its getExtractedMode() fallback: the caller's
// defaultDirMode/defaultFileMode, or 0o755/0o644 when those are not set.
function resolveDefaultMode(isDir, opts) {
    let mode = 0;

    if (isDir) {
        if (opts.defaultDirMode) {
            mode = parseInt(opts.defaultDirMode, 10);
        }

        if (!mode) {
            mode = 0o755;
        }
    } else {
        if (opts.defaultFileMode) {
            mode = parseInt(opts.defaultFileMode, 10);
        }

        if (!mode) {
            mode = 0o644;
        }
    }

    return mode;
}

/**
 * Normalises a zip entry's permissions in place so the extracting user can
 * always read, move and remove the result: directories gain at least owner rwx
 * and files at least owner rw, while existing execute/group/world bits are
 * preserved. Only the in-memory entry handed to extract-zip is changed; the
 * original zip file is never rewritten.
 *
 * @param {Object} entry - the yauzl entry extract-zip is about to extract
 * @param {Object} [opts] - the extract options (read for defaultDirMode/defaultFileMode)
 */
function ensureOwnerPermissions(entry, opts = {}) {
    let mode = getEntryMode(entry);
    const isDir = isDirectoryEntry(entry, mode);

    // No POSIX mode bits are present, so extract-zip would synthesise the mode
    // from defaultDirMode/defaultFileMode (falling back to 0o755/0o644). Resolve
    // that same default here so the owner bits below are guaranteed even when the
    // caller-supplied defaults omit them.
    if (mode === 0) {
        mode = resolveDefaultMode(isDir, opts);
    }

    const ownerBits = isDir ? OWNER_DIR_BITS : OWNER_FILE_BITS;
    let nextMode = mode | ownerBits;

    // A directory that was only inferred (trailing slash / Windows attribute)
    // may lack the POSIX directory type bit. Set it so extract-zip still
    // classifies the rewritten mode as a directory.
    if (isDir && (nextMode & S_IFMT) !== S_IFDIR) {
        nextMode = (nextMode & ~S_IFMT) | S_IFDIR;
    }

    // The mode extract-zip would already produce grants the owner the required
    // access and needs no type-bit fix, so leave the entry untouched.
    if (nextMode === mode) {
        return;
    }

    // Write the new POSIX mode back into the high 16 bits while preserving the
    // low 16 bits (DOS attributes and other zip-specific flags).
    const lowBits = entry.externalFileAttributes & 0xffff;
    entry.externalFileAttributes = (((nextMode & 0xffff) << 16) | lowBits) >>> 0;
}

module.exports = ensureOwnerPermissions;
