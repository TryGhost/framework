import type { EventEmitter } from 'events';

/**
 * Extract a zip archive into a folder, creating the folder if needed.
 *
 * Entries under `__MACOSX/` are skipped. The returned promise rejects with:
 * - `IncorrectUsageError` (`INVALID_ZIP_LIMIT`) for an invalid `limits` value
 * - `UnsupportedMediaTypeError` (from `@tryghost/errors`, status 415) with code
 *   `ENTRY_TOO_LARGE`, `TOTAL_TOO_LARGE`, `INVALID_ENTRY_SIZE`,
 *   `SYMLINK_NOT_ALLOWED` or `FILENAME_TOO_LONG` for a rejected entry
 * - a plain `Error` for an entry that would be written outside `destination`
 * - any error thrown by `options.onEntry`, or from reading the zip or writing files
 *
 * Entries processed before a rejection stay on disk.
 *
 * @param zipToExtract full path to the zip file
 * @param destination full path of the folder to extract into
 */
declare function extract(
    zipToExtract: string,
    destination: string,
    options?: extract.ExtractOptions,
): Promise<extract.ExtractResult>;

declare namespace extract {
    interface ExtractOptions {
        /**
         * Mode for directory entries that carry no permission bits. Defaults
         * to `0o755`.
         */
        defaultDirMode?: number;
        /**
         * Mode for file entries that carry no permission bits. Defaults to
         * `0o644`.
         */
        defaultFileMode?: number;
        /**
         * Called synchronously for every entry (except `__MACOSX/` ones) after
         * the built-in checks pass and before the entry is written. Throwing
         * aborts the extraction. The return value is ignored and is not awaited.
         */
        onEntry?: (entry: ZipEntry, zipfile: ZipFile) => void;
        /** Maximum uncompressed sizes. Unlimited by default. */
        limits?: ExtractLimits;
        /**
         * When `true`, give the owner at least rwx on extracted directories and
         * rw on extracted files, keeping any other permission bits. The zip file
         * itself is not modified. Defaults to `false`.
         */
        ensureOwnerPermissions?: boolean;
    }

    /**
     * Each limit must be a non-negative integer, `Infinity`, `null` or
     * `undefined`; `null` and `undefined` mean no limit.
     */
    interface ExtractLimits {
        /** Maximum declared uncompressed size of any single entry, in bytes. */
        perEntryUncompressedBytes?: number | null;
        /** Maximum declared uncompressed size of all entries combined, in bytes. */
        totalUncompressedBytes?: number | null;
    }

    interface ExtractResult {
        /** The `destination` path that was passed in. */
        path: string;
    }

    /**
     * A zip entry as read by `yauzl` (with `decodeStrings` enabled, so names and
     * comments are strings).
     */
    interface ZipEntry {
        fileName: string;
        fileComment: string;
        /** Alias of `fileComment`. */
        comment: string;
        versionMadeBy: number;
        versionNeededToExtract: number;
        generalPurposeBitFlag: number;
        compressionMethod: number;
        lastModFileTime: number;
        lastModFileDate: number;
        crc32: number;
        compressedSize: number;
        uncompressedSize: number;
        fileNameLength: number;
        extraFieldLength: number;
        fileCommentLength: number;
        internalFileAttributes: number;
        /** The POSIX mode lives in the high 16 bits. */
        externalFileAttributes: number;
        relativeOffsetOfLocalHeader: number;
        fileNameRaw: Buffer;
        extraFieldRaw: Buffer;
        fileCommentRaw: Buffer;
        extraFields: Array<{ id: number; data: Buffer }>;
        getLastModDate(options?: { forceDosFormat?: boolean; timezone?: 'UTC' | 'local' }): Date;
        isEncrypted(): boolean;
        isCompressed(): boolean;
        canDecodeFileData(): boolean;
    }

    /** The open `yauzl` zip file the entries are read from. */
    interface ZipFile extends EventEmitter {
        readonly entryCount: number;
        readonly comment: string;
        readonly fileSize: number;
        readonly entriesRead: number;
        readonly isOpen: boolean;
        close(): void;
    }
}

export = extract;
