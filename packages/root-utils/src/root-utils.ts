import fs from 'fs';
import path from 'path';
import findRoot from 'find-root';
import caller from 'caller';

/**
 * Get root directory of caller.
 *
 * Used to find the root directory (where a package.json exists) nearest to the calling module.
 *
 * Specifically, looks at the second caller - so that the place where `getCallerRoot()` is used
 * finds the directory of the package that called it.
 *
 * The `caller` package can find the calling module by creating an exception and walking the
 * stack trace. Easy to understand examples are given here:
 * https://www.npmjs.com/package/caller#depth
 */
export function getCallerRoot(): string | undefined {
    try {
        return findRoot(caller(2));
    } catch (err) {
        return;
    }
}

/**
 * Get root directory closest to the current working directory of the process.
 *
 * Used to find the root directory (where a package.json exists) nearest to the current
 * working directory of the process. This means that configuration that exists at the root
 * of the project can be accessed by any of the modules required by the project.
 *
 * Includes logic to determine whether a `current` symlink exists in the working directory,
 * which will be used rather than walking up the file tree if it exists
 */
export function getProcessRoot(): string | undefined {
    let workingDirectory: string = process.cwd();
    const currentFolder: string = path.join(workingDirectory, 'current');
    try {
        const folderInfo = fs.statSync(currentFolder);
        if (folderInfo.isDirectory()) {
            workingDirectory = currentFolder;
        }
    } catch (err) {
        // No-op - continue with normal working directory
    }
    try {
        return findRoot(workingDirectory);
    } catch (err) {
        return;
    }
}
