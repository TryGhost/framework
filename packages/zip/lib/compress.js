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

// yazl writes the DOS timestamp clamped to 1980 but writes the extended
// timestamp field with writeUInt32LE, which throws for pre-1970 mtimes. Clamp
// to the DOS minimum (local time, as yazl computes it) so both fields agree.
const MIN_MTIME = new Date(1980, 0, 1);

// The extended timestamp field is a signed 32-bit Unix time, so yazl caps it
// at January 2038. For later dates write only the DOS field (good to 2107).
const MAX_EXTENDED_MTIME = new Date(0x7fffffff * 1000);

function timestampOptions(mtime) {
    if (mtime < MIN_MTIME) {
        return { mtime: MIN_MTIME };
    }

    return { mtime, forceDosTimestamp: mtime > MAX_EXTENDED_MTIME };
}

// yazl rejects names that look like Windows drive paths (`c:foo`). Prefix them
// with `./`, which keeps the real name when extracted.
function toEntryName(relativePath) {
    return /^[a-zA-Z]:/.test(relativePath) ? `./${relativePath}` : relativePath;
}

function compareNames(a, b) {
    if (a.name === b.name) {
        return 0;
    }

    return a.name < b.name ? -1 : 1;
}

// Walks the folder depth-first in sorted order, skipping ignored paths without
// descending into them (so a large node_modules is never read). Everything that
// can fail on the filesystem (stat, readlink) happens here, before the
// destination is opened. `exclude` is the destination's full path, so a zip
// written inside the folder being zipped never includes itself.
async function collectEntries(root, ignore, exclude, relativeDir = '', entries = []) {
    const dirents = await fs.promises.readdir(path.join(root, relativeDir), {
        withFileTypes: true,
    });
    dirents.sort(compareNames);

    for (const dirent of dirents) {
        const relativePath = relativeDir ? `${relativeDir}/${dirent.name}` : dirent.name;

        if (isIgnored(relativePath, ignore)) {
            continue;
        }

        const fullPath = path.join(root, relativePath);

        if (fullPath === exclude) {
            continue;
        }

        let type;

        if (dirent.isDirectory()) {
            type = 'directory';
        } else if (dirent.isSymbolicLink()) {
            type = 'symlink';
        } else if (dirent.isFile()) {
            type = 'file';
        } else {
            // Sockets, FIFOs and devices cannot be zipped meaningfully.
            continue;
        }

        const stats = await fs.promises.lstat(fullPath);
        const entry = {
            type,
            fullPath,
            name: toEntryName(relativePath),
            options: { mode: stats.mode, ...timestampOptions(stats.mtime) },
        };

        // No `size` for files: yazl would then reject the whole zip if a file
        // changes size between this stat and the read. It only uses `size` to
        // precompute the zip size, and decides on ZIP64 either way.
        if (type === 'symlink') {
            // Store the target relative to the link, as archiver did, so an
            // absolute target does not bake this machine's paths into the zip.
            const linkDir = path.dirname(fullPath);
            const target = path.resolve(linkDir, await fs.promises.readlink(fullPath));
            entry.linkTarget = path.relative(linkDir, target).split(path.sep).join('/');
        }

        entries.push(entry);

        if (type === 'directory') {
            await collectEntries(root, ignore, exclude, relativePath, entries);
        }
    }

    return entries;
}

function writeZip(entries, destination) {
    return new Promise((resolve, reject) => {
        const zipfile = new yazl.ZipFile();
        const output = fs.createWriteStream(destination);
        // Source streams yazl is currently reading, so a failure can close them
        // rather than leaving their descriptors open.
        const openStreams = new Set();
        let opened = false;
        let settled = false;

        output.once('open', () => {
            opened = true;
        });

        const fail = (err) => {
            if (settled) {
                return;
            }

            settled = true;
            for (const stream of openStreams) {
                stream.destroy();
            }
            zipfile.outputStream.unpipe(output);
            zipfile.outputStream.destroy();

            // Remove the partly written zip once its descriptor is closed, but
            // only if this call opened it: when opening failed (e.g. EACCES on
            // an existing read-only file) the file there is not ours.
            const finish = () => {
                if (!opened) {
                    reject(err);
                    return;
                }

                fs.promises
                    .rm(destination, { force: true })
                    .catch(() => {})
                    .then(() => reject(err));
            };

            if (output.closed) {
                finish();
            } else {
                output.once('close', finish);
                output.destroy();
            }
        };

        const openReadStream = (fullPath) => (callback) => {
            // yazl keeps pumping queued entries after a failure; never open a
            // source once the zip has settled.
            if (settled) {
                return;
            }

            const stream = fs.createReadStream(fullPath);
            openStreams.add(stream);
            stream.on('close', () => openStreams.delete(stream));
            // yazl pipes the stream without listening for its errors.
            stream.on('error', fail);
            callback(null, stream);
        };

        zipfile.on('error', fail);
        output.on('error', fail);
        output.on('close', () => {
            if (settled) {
                return;
            }

            settled = true;
            resolve({ path: destination, size: output.bytesWritten });
        });

        zipfile.outputStream.pipe(output);

        // Directories go first. yazl writes a directory entry synchronously and
        // then recurses into the next queued entry, so a long run of
        // directories queued behind an unfinished file overflows the stack.
        // Added while nothing is pending, each one is written immediately.
        const ordered = [
            ...entries.filter((entry) => entry.type === 'directory'),
            ...entries.filter((entry) => entry.type !== 'directory'),
        ];

        try {
            for (const entry of ordered) {
                if (entry.type === 'directory') {
                    zipfile.addEmptyDirectory(entry.name, entry.options);
                } else if (entry.type === 'symlink') {
                    // Store symlinks as symlink entries (link target as data),
                    // not as the file they point to.
                    zipfile.addBuffer(Buffer.from(entry.linkTarget), entry.name, entry.options);
                } else {
                    // Lazy, so only one source file is open at a time.
                    zipfile.addReadStreamLazy(
                        entry.name,
                        entry.options,
                        openReadStream(entry.fullPath),
                    );
                }
            }
        } catch (err) {
            fail(err);
            return;
        }

        zipfile.end();
    });
}

// The destination's canonical path, to compare against paths under the
// (already resolved) folder being zipped. If the destination exists it is
// resolved fully, so a symlink to a file in the folder is excluded rather than
// read while the writer truncates it.
async function resolveDestination(destination) {
    const resolved = path.resolve(destination);

    try {
        return await fs.promises.realpath(resolved);
    } catch {
        // Not there yet (or a dangling symlink): resolve the directory instead.
    }

    try {
        return path.join(
            await fs.promises.realpath(path.dirname(resolved)),
            path.basename(resolved),
        );
    } catch {
        // The directory does not exist; opening the destination will fail.
        return resolved;
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
module.exports = async (folderToZip, destination, options = {}) => {
    const ignore = normalizeIgnore(options.ignore ?? defaultIgnore);

    // Resolve the folder fully: a symlinked folder is zipped as its target,
    // and entry paths must be canonical to compare against the destination.
    folderToZip = await fs.promises.realpath(folderToZip);

    const destinationPath = await resolveDestination(destination);
    const entries = await collectEntries(folderToZip, ignore, destinationPath);

    return writeZip(entries, destination);
};
