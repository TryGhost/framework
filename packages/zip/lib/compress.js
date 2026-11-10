const fs = require('fs');
const path = require('path');
const yazl = require('yazl');

const defaultIgnore = ['node_modules'];

// Ignore entries are relative path prefixes using `/` separators. A trailing
// `/` or `/**` is accepted for readability and stripped.
function trimTrailingSlashes(value) {
    let end = value.length;

    while (end > 0 && value[end - 1] === '/') {
        end -= 1;
    }

    return value.slice(0, end);
}

function normalizeIgnore(ignore) {
    return ignore.map((entry) => {
        let prefix = trimTrailingSlashes(entry.replaceAll('\\', '/'));

        if (prefix.endsWith('/**')) {
            prefix = trimTrailingSlashes(prefix.slice(0, -3));
        }

        return prefix;
    });
}

function isIgnored(relativePath, ignore) {
    return ignore.some(
        (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
    );
}

// Walks the folder depth-first in sorted order, skipping ignored paths without
// descending into them (so a large node_modules is never read).
function collectEntries(root, ignore, relativeDir = '', entries = []) {
    const dirents = fs
        .readdirSync(path.join(root, relativeDir), { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const dirent of dirents) {
        const relativePath = relativeDir ? `${relativeDir}/${dirent.name}` : dirent.name;

        if (isIgnored(relativePath, ignore)) {
            continue;
        }

        const fullPath = path.join(root, relativePath);

        if (dirent.isDirectory()) {
            entries.push({ type: 'directory', fullPath, relativePath });
            collectEntries(root, ignore, relativePath, entries);
        } else if (dirent.isSymbolicLink()) {
            entries.push({ type: 'symlink', fullPath, relativePath });
        } else if (dirent.isFile()) {
            entries.push({ type: 'file', fullPath, relativePath });
        }
    }

    return entries;
}

function addEntry(zipfile, entry) {
    if (entry.type === 'file') {
        // yazl stats the file itself and keeps its mode and mtime.
        zipfile.addFile(entry.fullPath, entry.relativePath);
        return;
    }

    const stats = fs.lstatSync(entry.fullPath);
    const options = { mode: stats.mode, mtime: stats.mtime };

    if (entry.type === 'directory') {
        zipfile.addEmptyDirectory(entry.relativePath, options);
    } else {
        // Store symlinks as symlink entries (link target as data), not as the
        // file they point to.
        zipfile.addBuffer(
            Buffer.from(fs.readlinkSync(entry.fullPath)),
            entry.relativePath,
            options,
        );
    }
}

/**
 * Compress
 *
 * - Create a zip file from a folder, including dotfiles and empty directories
 *
 * @param {String} folderToZip - full path to the folder to be zipped
 * @param {String} destination - full path to the resulting zip file
 * @param {Object} [options]
 * @param {String[]} [options.ignore] - relative path prefixes to leave out, defaults to `['node_modules']`
 * @returns {Promise<{path: String, size: Number}>}
 */
module.exports = (folderToZip, destination, options = {}) => {
    const ignore = normalizeIgnore(options.ignore ?? defaultIgnore);

    return new Promise((resolve, reject) => {
        // If folder to zip is a symlink, we want to get the target
        // of the link and zip that instead of zipping the symlink
        if (fs.lstatSync(folderToZip).isSymbolicLink()) {
            folderToZip = fs.realpathSync(folderToZip);
        }

        const entries = collectEntries(folderToZip, ignore);
        const zipfile = new yazl.ZipFile();
        let output;
        let settled = false;

        const fail = (err) => {
            if (settled) {
                return;
            }

            settled = true;
            if (output) {
                zipfile.outputStream.unpipe(output);
                output.destroy();
            }
            reject(err);
        };

        zipfile.on('error', fail);

        // Adding entries can throw synchronously (e.g. an unreadable symlink),
        // so do it before the destination file is opened.
        for (const entry of entries) {
            addEntry(zipfile, entry);
        }

        output = fs.createWriteStream(destination);
        output.on('error', fail);
        output.on('close', () => {
            if (settled) {
                return;
            }

            settled = true;
            resolve({ path: destination, size: fs.statSync(destination).size });
        });

        zipfile.outputStream.pipe(output);
        zipfile.end();
    });
};
