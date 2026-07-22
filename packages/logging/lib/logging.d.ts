import GhostLogger = require('./GhostLogger');

/**
 * A pre-configured `GhostLogger` instance (built from `loggingrc` if present),
 * with the `GhostLogger` class attached for creating additional instances.
 */
declare const logging: GhostLogger & {
    GhostLogger: typeof GhostLogger;
    /**
     * Clear the cached process-wide logger instance. Intended for tests only.
     */
    resetForTesting(): void;
};

declare namespace logging {
    export type LogLevel = GhostLogger.LogLevel;
    export type Transport = GhostLogger.Transport;
    export type RotationOptions = GhostLogger.RotationOptions;
    export type ElasticsearchOptions = GhostLogger.ElasticsearchOptions;
    export type GelfOptions = GhostLogger.GelfOptions;
    export type HttpOptions = GhostLogger.HttpOptions;
    export type GhostLoggerOptions = GhostLogger.GhostLoggerOptions;
}

export = logging;
