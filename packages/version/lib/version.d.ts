/**
 * Version information read from the `package.json` at the process root.
 */
declare const version: {
    /** `major.minor`, e.g. `5.12`. */
    safe: string;
    /** `major.minor.patch` plus any prerelease suffix, e.g. `5.12.1-rc.0`. */
    full: string;
    /** The original version string, including any build metadata. */
    original: string;
};

export = version;
