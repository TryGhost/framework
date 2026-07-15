type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type Transport = 'stdout' | 'stderr' | 'parent' | 'file' | 'gelf' | 'http' | 'elasticsearch';

interface RotationOptions {
    enabled?: boolean;
    period?: string;
    count?: number;
    /**
     * Use the `@tryghost/bunyan-rotating-filestream` library instead of the
     * built-in bunyan rotation.
     */
    useLibrary?: boolean;
    threshold?: string | number;
    gzip?: boolean;
    rotateExisting?: boolean;
}

interface ElasticsearchOptions {
    host?: string;
    username?: string;
    password?: string;
    index?: string;
    pipeline?: string;
    level?: LogLevel;
}

interface GelfOptions {
    host?: string;
    port?: number;
    options?: object;
}

interface HttpOptions {
    url?: string;
    headers?: Record<string, string>;
    username?: string;
    password?: string;
    level?: LogLevel;
}

interface GhostLoggerOptions {
    /** Name of the logger. Appears in raw log files as `{"name": ...}`. */
    name?: string;
    /** Used for creating the file name. */
    domain?: string;
    /** Used for creating the file name. */
    env?: string;
    /** Used to print short or long log. */
    mode?: string;
    /** The default level of all transports except stderr. */
    level?: LogLevel;
    /** Whether the body of a request should be logged to the target stream. */
    logBody?: boolean;
    /** Transports to log to (e.g. `stdout`, `stderr`, `gelf`, `file`). */
    transports?: Transport[];
    /** File rotation configuration. */
    rotation?: RotationOptions;
    /** Path where log files are stored. */
    path?: string;
    /**
     * Optional filename template for log files. Supports `{env}` and `{domain}`
     * placeholders. Defaults to `{domain}_{env}`.
     */
    filename?: string;
    /** Elasticsearch transport configuration. */
    elasticsearch?: ElasticsearchOptions;
    /** Gelf transport configuration. */
    gelf?: GelfOptions;
    /** HTTP transport configuration. */
    http?: HttpOptions;
    /** Use local time instead of UTC. */
    useLocalTime?: boolean;
    /** Optional set of metadata to attach to each log line. */
    metadata?: Record<string, unknown>;
}

/**
 * Ghost's logger class.
 *
 * The logger handles any stdout/stderr logs and streams them into the
 * configured transports.
 */
declare class GhostLogger {
    name: string;
    env: string;
    domain: string;
    transports: Transport[];
    level: LogLevel;
    logBody: boolean;
    mode: string;
    path: string;
    filename: string;
    elasticsearch: ElasticsearchOptions;
    gelf: GelfOptions;
    http: HttpOptions;
    useLocalTime: boolean;
    metadata: Record<string, unknown>;
    rotation: RotationOptions;
    streams: Record<string, { name: string; log: unknown }>;
    serializers: Record<string, (input: any) => unknown>;

    constructor(options?: GhostLoggerOptions);

    /** Sanitize a domain for use in filenames. */
    sanitizeDomain(domain: string): string;

    /** Replace `{env}`/`{domain}` placeholders in a filename template. */
    replaceFilenamePlaceholders(template: string): string;

    /** Remove sensitive data (passwords, keys, cookies, ...) from an object. */
    removeSensitiveData<T extends object>(obj: T): T;

    /** Centralised log function. */
    log(type: LogLevel, args: unknown[]): void;

    trace(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    fatal(...args: unknown[]): void;

    /** Create a child logger with some properties bound to every log message. */
    child(boundProperties: Record<string, unknown>): GhostLogger;
}

declare namespace GhostLogger {
    export {
        LogLevel,
        Transport,
        RotationOptions,
        ElasticsearchOptions,
        GelfOptions,
        HttpOptions,
        GhostLoggerOptions,
    };
}

export = GhostLogger;
