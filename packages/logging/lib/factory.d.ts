import GhostLoggerClass = require('./GhostLogger');

/**
 * Side-effect free entry point: importing it builds no logger and reads no
 * `loggingrc`.
 */
declare const factory: {
    GhostLogger: typeof GhostLoggerClass;
    /**
     * Build a logger from the given options. Reads no `loggingrc`, registers
     * nothing and does not adjust transports in worker threads. The
     * constructor's environment overrides (`LEVEL`, `MODE`, `LOIN`) still
     * apply.
     */
    createLogger(options?: GhostLoggerClass.GhostLoggerOptions): GhostLoggerClass;
    /**
     * Make `instance` the process-wide (per-thread) logger returned by
     * `require('@tryghost/logging')`. Returns the instance.
     *
     * Throws if a different instance already exists; calling it again with the
     * same instance is a no-op.
     */
    setInstance<T extends GhostLoggerClass>(instance: T): T;
};

declare namespace factory {
    export type GhostLogger = GhostLoggerClass;
    export type LogLevel = GhostLoggerClass.LogLevel;
    export type Transport = GhostLoggerClass.Transport;
    export type RotationOptions = GhostLoggerClass.RotationOptions;
    export type HttpOptions = GhostLoggerClass.HttpOptions;
    export type GhostLoggerOptions = GhostLoggerClass.GhostLoggerOptions;
}

export = factory;
