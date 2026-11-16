/**
 * Create an archive (zip by default) from the contents of a folder.
 *
 * If `folderToZip` is a symlink, its target is archived instead. Resolves once
 * the destination file has been written and closed.
 *
 * Throws synchronously if `options.type` is not a supported archive type. The
 * returned promise rejects if `folderToZip` cannot be read or archiving fails.
 *
 * @param folderToZip full path to the folder to archive
 * @param destination full path of the archive file to write
 */
declare function compress(
    folderToZip: string,
    destination: string,
    options?: compress.CompressOptions,
): Promise<compress.CompressResult>;

declare namespace compress {
    interface CompressOptions {
        /** Archive format. Defaults to `'zip'`. */
        type?: 'zip' | 'tar' | 'json';
        /** Glob of files to include, relative to the folder. Defaults to `'**\/*'`. */
        glob?: string;
        /** Whether globs match dotfiles and dotfolders. Defaults to `true`. */
        dot?: boolean;
        /**
         * Glob pattern(s) of paths to leave out, relative to the folder.
         * Defaults to `['node_modules/**']`; passing a value replaces the default.
         */
        ignore?: string | string[];
    }

    interface CompressResult {
        /** The `destination` path that was passed in. */
        path: string;
        /** Size of the written archive in bytes. */
        size: number;
    }
}

export = compress;
