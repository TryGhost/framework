const errors = require('@tryghost/errors');

const defaultOptions = {};

function throwOnSymlinks(entry) {
    // Check if symlink
    const mode = (entry.externalFileAttributes >> 16) & 0xFFFF;
    // check if it's a symlink or dir (using stat mode constants)
    const IFMT = 61440;
    const IFLNK = 40960;
    const symlink = (mode & IFMT) === IFLNK;

    if (symlink) {
        throw new errors.UnsupportedMediaTypeError({
            message: 'Symlinks in ZIP-files are not allowed'
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
 * @param {Integer} options.defaultDirMode - Directory Mode (permissions), defaults to 0o755
 * @param {Integer} options.defaultFileMode - File Mode (permissions), defaults to 0o644
 * @param {Function} options.onEntry - if present, will be called with (entry, zipfile) for every entry in the zip
 */
module.exports = (zipToExtract, destination, options) => {
    const opts = Object.assign({}, defaultOptions, options);

    const extract = require('extract-zip');

    opts.dir = destination;

    if (opts.onEntry) {
        opts.onEntry = (entry, zipfile) => {
            throwOnSymlinks(entry);
            options.onEntry(entry, zipfile);
        };
    } else {
        opts.onEntry = throwOnSymlinks;
    }

    return extract(zipToExtract, opts).then(() => {
        return {path: destination};
    });
};
