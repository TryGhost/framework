const path = require('path');
const {promises: fs} = require('fs');
const AdmZip = require('adm-zip');
const fsExtra = require('fs-extra');

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
 * @returns {Promise<{path: string}>}
 */
module.exports = async (zipToExtract, destination, options) => {
    if (options) {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('options are not supported anymore');
    }

    if (!path.isAbsolute(destination)) {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('Target directory is expected to be absolute');
    }

    // Create the folder if it doesn't exist (same behaviour as extract-zip)
    await fs.mkdir(destination, {recursive: true});
    destination = await fs.realpath(destination);

    const zip = new AdmZip(zipToExtract);

    // Filter all __MACOSX folders and .DS_Store files
    for (const entry of zip.getEntries()) {
        if (entry.name === '__MACOSX' && entry.isDirectory) {
            zip.deleteFile(entry);
        } else if (entry.name === '.DS_Store' && !entry.isDirectory) {
            zip.deleteFile(entry);
        }
    }

    await new Promise((resolve, reject) => {
        // adm-zip can call the callback multiple times, so we need to make sure we only resolve/reject once
        let called = false;
        zip.extractAllToAsync(destination, false, false, (err) => {
            if (called) {
                return;
            }
            called = true;
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });

    // Remove __MACOSX
    const macosxPath = path.join(destination, '__MACOSX');
    await fsExtra.remove(macosxPath);
    return {
        path: destination
    };
};
