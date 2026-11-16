/**
 * Get the root directory (where a `package.json` exists) nearest to the module
 * that called this function. Returns `undefined` if none can be found.
 */
export declare function getCallerRoot(): string | undefined;

/**
 * Get the root directory (where a `package.json` exists) nearest to the
 * process working directory. Prefers a `current` symlink in the working
 * directory if one exists. Returns `undefined` if none can be found.
 */
export declare function getProcessRoot(): string | undefined;
