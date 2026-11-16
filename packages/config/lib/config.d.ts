/**
 * The cached nconf `Provider` instance. It is loaded from argv, environment
 * variables (`__` as the nesting separator), `config.<env>.json` and
 * `config.example.json` defaults found at the process root.
 */
declare const config: config.Config;

declare namespace config {
    /**
     * The commonly used parts of the nconf `Provider` API.
     */
    interface Config {
        /** Read a value by colon-delimited key, or the whole config when no key is given. */
        get(key?: string): any;
        /** Set a value by colon-delimited key. */
        set(key: string, value: unknown): Config;
        /** Remove a value by colon-delimited key. */
        clear(key: string): Config;
        /** Merge an object into the value at a colon-delimited key. */
        merge(key: string, value: unknown): Config;
        /** Reset all stores. */
        reset(callback?: (err?: Error) => void): void;
        /** Return the first key that has a value. */
        any(keys: string[]): any;
        /** Throw unless all the given keys have values. */
        required(keys: string[]): Config;
        defaults(options: object): Config;
        overrides(options: object): Config;
    }
}

export = config;
