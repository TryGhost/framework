/**
 * A rotating file stream for bunyan, with period-based and size-based
 * rotation, gzip compression of archives and limits on the number and total
 * size of archived files.
 *
 * Only one stream may exist per `path` at a time; constructing a second one
 * for the same path throws until the first has been `end()`ed.
 */
declare class RotatingFileStream {
    /**
     * @throws {Error} if `config.path` is not a string, or a stream already
     *   exists for that path.
     * @throws {TypeError} if `period`, `threshold` or `totalSize` is a string
     *   that does not match the documented formats.
     */
    constructor(config: RotatingFileStream.Config);

    /**
     * Queue a chunk (bunyan passes one serialised log line) to be written to
     * the current file. Writes happen asynchronously; the returned promise
     * resolves once the chunk is queued, not once it is on disk.
     */
    write(data: string): Promise<void>;

    /**
     * Force everything written into this stream so far out to disk, without
     * closing it. The stream stays writable afterwards, unlike `end()`.
     * Resolves immediately if the stream has already been ended.
     */
    flush(): Promise<void>;

    /**
     * Drain the write queue, stop rotation, close the file handle and release
     * the path so a new stream can be created for it.
     */
    end(): Promise<void>;

    /** Calls `end()` without waiting for it. */
    destroy(): void;

    /** Calls `end()` without waiting for it. */
    destroySoon(): void;
}

declare namespace RotatingFileStream {
    interface Config {
        /**
         * Path of the current log file. Backups are named by inserting the
         * backup number before the extension (`foo.0.log`, `foo.1.log`, ...),
         * or by replacing a `%N` placeholder in the file name if present.
         */
        path: string;
        /**
         * Rotate on a schedule. Either `hourly`, `daily`, `weekly`, `monthly`
         * or `yearly`, or a positive integer followed by a unit: `h` (hours),
         * `d` (days), `w` (weeks), `m` (months), `y` (years) or `ms`
         * (milliseconds), e.g. `'1d'` or `'12h'`. Falsy disables period-based
         * rotation.
         */
        period?: string;
        /**
         * When period-based rotation is enabled, schedule the first rotation
         * from the existing file's creation time instead of from start-up.
         */
        rotateExisting?: boolean;
        /**
         * Rotate once the current file grows past this size. Either a number of
         * bytes, or a positive integer followed by a lower-case unit: `b`
         * (bytes), `k` (KiB), `m` (MiB) or `g` (GiB), e.g. `'10m'`. Falsy
         * disables size-based rotation.
         */
        threshold?: string | number;
        /**
         * Maximum number of backup files to keep; the current file is not
         * counted. Falsy keeps every backup.
         */
        totalFiles?: number;
        /**
         * Maximum combined size of the backup files, in the same format as
         * `threshold`. Falsy applies no size limit.
         */
        totalSize?: string | number;
        /** Gzip backup files when rotating. */
        gzip?: boolean;
        /** Rotate on start-up so logging always begins in a new file. */
        startNewFile?: boolean;
    }
}

export = RotatingFileStream;
