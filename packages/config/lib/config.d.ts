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
        /** Set a value by colon-delimited key. Returns the store's result, not the provider. */
        set(key: string, value: unknown): boolean;
        /** Remove a value by colon-delimited key. Returns the store's result, not the provider. */
        clear(key: string): boolean;
        /** Merge an object into the value at a colon-delimited key. Returns the store's result, not the provider. */
        merge(key: string, value: unknown): boolean;
        /** Reset all stores. */
        reset(callback?: (err?: Error) => void): void;
        /** Return the first key that has a value. */
        any(keys: string[]): any;
        /** Throw unless all the given keys have values; returns `true` otherwise. */
        required(keys: string[]): true;
        defaults(options: object): Config;
        overrides(options: object): Config;
    }
}

export = config;
