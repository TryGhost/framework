/**
 * A debug logger function, as returned by the `debug` package.
 */
interface Debugger {
    (formatter: unknown, ...args: unknown[]): void;
    enabled: boolean;
    namespace: string;
    /**
     * The selected colour for this namespace. A string in the browser build,
     * a numeric ANSI code under Node (as returned by `selectColor()`).
     */
    color: string | number;
    log: (...args: unknown[]) => void;
    destroy(): boolean;
    extend(namespace: string, delimiter?: string): Debugger;
}

/**
 * A map of custom `%`-formatters registered on the `debug` module.
 */
interface Formatters {
    [formatter: string]: (value: unknown) => string;
}

/**
 * The underlying `debug` module.
 */
interface DebugModule {
    (namespace: string): Debugger;
    enable(namespaces: string): void;
    disable(): string;
    enabled(namespace: string): boolean;
    /** Custom formatters, keyed by the format letter (e.g. `debug.formatters.h`). */
    formatters: Formatters;
    names: RegExp[];
    skips: RegExp[];
}

/**
 * Create a debug instance based on your package.json alias/name.
 *
 * The challenge here is to figure out where your package.json exists.
 */
interface InitDebug {
    /**
     * @param name - Name of the debug unit.
     */
    (name: string): Debugger;

    /**
     * The underlying `debug` module.
     */
    _base: DebugModule;
}

declare const initDebug: InitDebug;

export = initDebug;
