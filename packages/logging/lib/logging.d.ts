import GhostLoggerClass = require('./GhostLogger');

/**
 * A pre-configured `GhostLogger` instance (built from `loggingrc` if present),
 * with the `GhostLogger` class attached for creating additional instances.
 */
declare const logging: GhostLoggerClass & {
    GhostLogger: typeof GhostLoggerClass;
    /**
     * Clear the cached process-wide logger instance. Intended for tests only.
     */
    resetForTesting(): void;
};

declare namespace logging {
    /**
     * Instance type of the `GhostLogger` class, so consumers can annotate
     * values with `GhostLogger` without reaching for `InstanceType<>`.
     */
    export type GhostLogger = GhostLoggerClass;
    export type LogLevel = GhostLoggerClass.LogLevel;
    export type Transport = GhostLoggerClass.Transport;
    export type RotationOptions = GhostLoggerClass.RotationOptions;
    export type ElasticsearchOptions = GhostLoggerClass.ElasticsearchOptions;
    export type GelfOptions = GhostLoggerClass.GelfOptions;
    export type HttpOptions = GhostLoggerClass.HttpOptions;
    export type GhostLoggerOptions = GhostLoggerClass.GhostLoggerOptions;
}

export = logging;
