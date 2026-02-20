import each from 'lodash/each';
import upperFirst from 'lodash/upperFirst';
import toArray from 'lodash/toArray';
import isObject from 'lodash/isObject';
import isEmpty from 'lodash/isEmpty';
import includes from 'lodash/includes';
import bunyan from 'bunyan';
import fs from 'fs';
import jsonStringifySafe from 'json-stringify-safe';
import {parentPort} from 'worker_threads';
import GhostPrettyStream from '@tryghost/pretty-stream';
import Bunyan2Loggly from 'bunyan-loggly';
import * as gelfStream from 'gelf-stream';
import {BunyanStream as ElasticSearch} from '@tryghost/elasticsearch';
import HttpStream from '@tryghost/http-stream';
import RotatingFileStream from '@tryghost/bunyan-rotating-filestream';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type TransportName = 'stdout' | 'stderr' | 'parent' | 'loggly' | 'elasticsearch' | 'gelf' | 'file' | 'http';

export interface RotationOptions {
    enabled: boolean;
    period?: string;
    count?: number;
    threshold?: string;
    gzip?: boolean;
    totalFiles?: number;
    rotateExisting?: boolean;
    useLibrary?: boolean;
}

export interface LogglyConfig {
    token?: string;
    subdomain?: string;
    tags?: string[];
    match?: string;
}

export interface ElasticsearchConfig {
    host?: string;
    username?: string;
    password?: string;
    index?: string;
    pipeline?: string;
    level?: LogLevel;
}

export interface GelfConfig {
    host?: string;
    port?: number;
    options?: Record<string, unknown>;
}

export interface HttpConfig {
    url?: string;
    headers?: Record<string, string>;
    username?: string;
    password?: string;
    level?: LogLevel;
}

export interface GhostLoggerOptions {
    name?: string;
    env?: string;
    domain?: string;
    transports?: TransportName[];
    level?: LogLevel;
    logBody?: boolean;
    mode?: string;
    path?: string;
    filename?: string;
    loggly?: LogglyConfig;
    elasticsearch?: ElasticsearchConfig;
    gelf?: GelfConfig;
    http?: HttpConfig;
    rotation?: Partial<RotationOptions>;
    useLocalTime?: boolean;
    metadata?: Record<string, unknown>;
}

interface StreamEntry {
    name: string;
    log: bunyan;
    match?: string;
}

interface RequestLike {
    requestId?: string;
    userId?: string;
    url?: string;
    method?: string;
    originalUrl?: string;
    params?: unknown;
    headers?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    extra?: unknown;
    queueDepth?: number;
}

interface ResponseLike {
    getHeaders(): Record<string, unknown>;
    statusCode?: number;
    responseTime?: number;
}

interface ErrorLike {
    id?: string;
    code?: string;
    errorType?: string;
    statusCode?: number;
    level?: string;
    message?: string;
    context?: unknown;
    help?: unknown;
    stack?: string;
    hideStack?: boolean;
    errorDetails?: unknown;
}

/**
 * @description Ghost's logger class.
 *
 * The logger handles any stdout/stderr logs and streams it into the configured transports.
 */
class GhostLogger {
    name: string;
    env: string;
    domain: string;
    transports: TransportName[];
    level: LogLevel;
    logBody: boolean;
    mode: string;
    path: string;
    filename: string;
    loggly: LogglyConfig;
    elasticsearch: ElasticsearchConfig;
    gelf: GelfConfig;
    http: HttpConfig;
    useLocalTime: boolean;
    metadata: Record<string, unknown>;
    rotation: RotationOptions;
    streams: Record<string, StreamEntry>;
    serializers!: bunyan.Serializers;

    /**
     * Properties in the options bag:
     *
     * name:            Name of the logger. The name will appear in the raw log files with {"name": String...}
     * domain:          Is used for creating the file name.
     * env:             Is used for creating the file name.
     * mode:            Is used to print short or long log.
     * level:           The level defines the default level of all transports except of stderr.
     * logBody:         Disable or enable if the body of a request should be logged to the target stream.
     * transports:      An array of comma separated transports (e.g. stdout, stderr, geld, loggly, file)
     * rotation:        Enable or disable file rotation.
     * path:            Path where to store log files.
     * filename:        Optional filename template for log files. Supports {env} and {domain} placeholders.
     *                  If not provided, defaults to {domain}_{env} format.
     * loggly:          Loggly transport configuration.
     * elasticsearch:   Elasticsearch transport configuration
     * gelf:            Gelf transport configuration.
     * http:            HTTP transport configuration
     * useLocalTime:    Use local time instead of UTC.
     * metadata:        Optional set of metadata to attach to each log line
     */
    constructor(options: GhostLoggerOptions = {}) {
        this.name = options.name ?? 'Log';
        this.env = options.env ?? 'development';
        this.domain = options.domain ?? 'localhost';
        this.transports = options.transports ?? ['stdout'];
        this.level = (process.env.LEVEL as LogLevel | undefined) ?? options.level ?? 'info';
        this.logBody = options.logBody ?? false;
        this.mode = process.env.MODE ?? options.mode ?? 'short';
        this.path = options.path ?? process.cwd();
        this.filename = options.filename ?? '{domain}_{env}';
        this.loggly = options.loggly ?? {};
        this.elasticsearch = options.elasticsearch ?? {};
        this.gelf = options.gelf ?? {};
        this.http = options.http ?? {};
        this.useLocalTime = options.useLocalTime ?? false;
        this.metadata = options.metadata ?? {};

        // CASE: stdout has to be on the first position in the transport, because if the GhostLogger itself logs, you won't see the stdout print
        if (this.transports.indexOf('stdout') !== -1 && this.transports.indexOf('stdout') !== 0) {
            this.transports.splice(this.transports.indexOf('stdout'), 1);
            this.transports = (['stdout'] as TransportName[]).concat(this.transports);
        }

        // CASE: special env variable to enable long mode and level info
        if (process.env.LOIN) {
            this.level = 'info';
            this.mode = 'long';
        }

        // CASE: ensure we have a trailing slash
        if (!this.path.match(/\/$|\\/)) {
            this.path = this.path + '/';
        }

        this.rotation = {
            enabled: false,
            period: '1w',
            count: 100,
            ...options.rotation
        };

        this.streams = {};
        this.setSerializers();

        if (includes(this.transports, 'stderr') && !includes(this.transports, 'stdout')) {
            this.transports.push('stdout');
        }

        this.transports.forEach((transport) => {
            const transportFn = `set${upperFirst(transport)}Stream` as keyof this;

            if (typeof this[transportFn] !== 'function') {
                throw new Error(`${upperFirst(transport)} is an invalid transport`); // eslint-disable-line
            }

            (this[transportFn] as () => void)();
        });
    }

    /**
     * @description Setup stdout stream.
     */
    setStdoutStream() {
        const prettyStdOut = new GhostPrettyStream({
            mode: this.mode
        });

        prettyStdOut.pipe(process.stdout);

        this.streams.stdout = {
            name: 'stdout',
            log: bunyan.createLogger({
                name: this.name,
                streams: [{
                    type: 'raw',
                    stream: prettyStdOut,
                    level: this.level
                }],
                serializers: this.serializers
            })
        };
    }

    /**
     * @description Setup stderr stream.
     */
    setStderrStream() {
        const prettyStdErr = new GhostPrettyStream({
            mode: this.mode
        });

        prettyStdErr.pipe(process.stderr);

        this.streams.stderr = {
            name: 'stderr',
            log: bunyan.createLogger({
                name: this.name,
                streams: [{
                    type: 'raw',
                    stream: prettyStdErr,
                    level: 'error'
                }],
                serializers: this.serializers
            })
        };
    }

    /**
     * Setup stream for posting the message to a parent instance
     */
    setParentStream() {
        const bunyanStream = {
            // Parent stream only supports sending a string
            write: (bunyanObject: object) => {
                parentPort!.postMessage((bunyanObject as {msg: string}).msg);
            }
        };

        this.streams.parent = {
            name: 'parent',
            log: bunyan.createLogger({
                name: this.name,
                streams: [{
                    type: 'raw',
                    stream: bunyanStream,
                    level: this.level
                }],
                serializers: this.serializers
            })
        };
    }

    /**
     * @description Setup loggly.
     */
    setLogglyStream() {
        const logglyStream = new Bunyan2Loggly({
            token: this.loggly.token ?? '',
            subdomain: this.loggly.subdomain ?? '',
            tags: this.loggly.tags
        });

        this.streams.loggly = {
            name: 'loggly',
            match: this.loggly.match,
            log: bunyan.createLogger({
                name: this.name,
                streams: [{
                    type: 'raw',
                    stream: logglyStream,
                    level: 'error'
                }],
                serializers: this.serializers
            })
        };
    }

    /**
     * @description Setup ElasticSearch.
     */
    setElasticsearchStream() {
        const elasticSearchInstance = new ElasticSearch({
            node: this.elasticsearch.host,
            auth: {
                username: this.elasticsearch.username,
                password: this.elasticsearch.password
            }
        }, this.elasticsearch.index, this.elasticsearch.pipeline);

        this.streams.elasticsearch = {
            name: 'elasticsearch',
            log: bunyan.createLogger({
                name: this.name,
                streams: [{
                    type: 'stream',
                    stream: elasticSearchInstance.getStream(),
                    level: this.elasticsearch.level
                }],
                serializers: this.serializers
            })
        };
    }

    setHttpStream() {
        const httpStream = new HttpStream({
            url: this.http.url,
            headers: this.http.headers ?? {},
            username: this.http.username ?? '',
            password: this.http.password ?? ''
        });

        this.streams.http = {
            name: 'http',
            log: bunyan.createLogger({
                name: this.name,
                streams: [{
                    type: 'raw',
                    stream: httpStream,
                    level: this.http.level
                }],
                serializers: this.serializers
            })
        };
    }

    /**
     * @description Setup gelf.
     */
    setGelfStream() {
        const stream = gelfStream.forBunyan(
            this.gelf.host ?? 'localhost',
            this.gelf.port ?? 12201,
            this.gelf.options ?? {}
        );

        this.streams.gelf = {
            name: 'gelf',
            log: bunyan.createLogger({
                name: this.name,
                streams: [{
                    type: 'raw',
                    stream: stream,
                    level: this.level
                }],
                serializers: this.serializers
            })
        };
    }

    /**
     * @description Sanitize domain for use in filenames.
     * Replaces all non-word characters with underscores.
     * @param domain - The domain to sanitize
     * @returns Sanitized domain safe for filenames
     * @example
     * sanitizeDomain('http://my-domain.com') // returns 'http___my_domain_com'
     */
    sanitizeDomain(domain: string): string {
        return domain.replace(/[^\w]/gi, '_');
    }

    /**
     * @description Replace placeholders in filename template.
     * @param template - Filename template with placeholders
     * @returns Filename with placeholders replaced
     */
    // TODO: Expand to other placeholders?
    replaceFilenamePlaceholders(template: string): string {
        return template
            .replace(/{env}/g, this.env)
            .replace(/{domain}/g, this.sanitizeDomain(this.domain));
    }

    /**
     * @description Setup file stream.
     *
     * By default we log into two files
     * 1. file-errors: all errors only
     * 2. file-all: everything
     */
    setFileStream() {
        const baseFilename = this.replaceFilenamePlaceholders(this.filename);

        // CASE: target log folder does not exist, show warning
        if (!fs.existsSync(this.path)) {
            this.error('Target log folder does not exist: ' + this.path);
            return;
        }

        if (this.rotation.enabled) {
            if (this.rotation.useLibrary) {
                const rotationConfig = {
                    path: `${this.path}${baseFilename}.log`,
                    period: this.rotation.period,
                    threshold: this.rotation.threshold,
                    totalFiles: this.rotation.count,
                    gzip: this.rotation.gzip,
                    rotateExisting: (typeof this.rotation.rotateExisting === 'undefined') ? true : this.rotation.rotateExisting
                };

                this.streams['rotation-errors'] = {
                    name: 'rotation-errors',
                    log: bunyan.createLogger({
                        name: this.name,
                        streams: [{
                            stream: new RotatingFileStream(Object.assign({}, rotationConfig, {
                                path: `${this.path}${baseFilename}.error.log`
                            })),
                            level: 'error'
                        }],
                        serializers: this.serializers
                    })
                };

                this.streams['rotation-all'] = {
                    name: 'rotation-all',
                    log: bunyan.createLogger({
                        name: this.name,
                        streams: [{
                            stream: new RotatingFileStream(rotationConfig),
                            level: this.level
                        }],
                        serializers: this.serializers
                    })
                };
            } else {
                // TODO: Remove this when confidence is high in the external library for rotation
                this.streams['rotation-errors'] = {
                    name: 'rotation-errors',
                    log: bunyan.createLogger({
                        name: this.name,
                        streams: [{
                            type: 'rotating-file',
                            path: `${this.path}${baseFilename}.error.log`,
                            period: this.rotation.period,
                            count: this.rotation.count,
                            level: 'error'
                        }],
                        serializers: this.serializers
                    })
                };

                this.streams['rotation-all'] = {
                    name: 'rotation-all',
                    log: bunyan.createLogger({
                        name: this.name,
                        streams: [{
                            type: 'rotating-file',
                            path: `${this.path}${baseFilename}.log`,
                            period: this.rotation.period,
                            count: this.rotation.count,
                            level: this.level
                        }],
                        serializers: this.serializers
                    })
                };
            }
        } else {
            this.streams['file-errors'] = {
                name: 'file',
                log: bunyan.createLogger({
                    name: this.name,
                    streams: [{
                        path: `${this.path}${baseFilename}.error.log`,
                        level: 'error'
                    }],
                    serializers: this.serializers
                })
            };

            this.streams['file-all'] = {
                name: 'file',
                log: bunyan.createLogger({
                    name: this.name,
                    streams: [{
                        path: `${this.path}${baseFilename}.log`,
                        level: this.level
                    }],
                    serializers: this.serializers
                })
            };
        }
    }

    // @TODO: res.on('finish') has no access to the response body
    /**
     * @description Serialize the log input.
     *
     * The goals are:
     *   - avoiding to log to much (pick useful information from request/response
     *   - removing/replacing sensitive data from logging to a stream/transport
     */
    setSerializers() {
        this.serializers = {
            req: (req: RequestLike) => {
                const requestLog: Record<string, unknown> = {
                    meta: {
                        requestId: req.requestId,
                        userId: req.userId
                    },
                    url: req.url,
                    method: req.method,
                    originalUrl: req.originalUrl,
                    params: req.params,
                    headers: this.removeSensitiveData(req.headers ?? {}),
                    query: this.removeSensitiveData(req.query ?? {})
                };

                if (req.extra) {
                    requestLog.extra = req.extra;
                }

                if (this.logBody) {
                    requestLog.body = this.removeSensitiveData(req.body ?? {});
                }

                if (req.queueDepth) {
                    requestLog.queueDepth = req.queueDepth;
                }

                return requestLog;
            },
            res: (res: ResponseLike) => {
                return {
                    _headers: this.removeSensitiveData(res.getHeaders()),
                    statusCode: res.statusCode,
                    responseTime: res.responseTime
                };
            },
            err: (err: ErrorLike) => {
                return {
                    id: err.id,
                    domain: this.domain,
                    code: err.code,
                    name: err.errorType,
                    statusCode: err.statusCode,
                    level: err.level,
                    message: err.message,
                    context: jsonStringifySafe(err.context),
                    help: jsonStringifySafe(err.help),
                    stack: err.stack,
                    hideStack: err.hideStack,
                    errorDetails: jsonStringifySafe(err.errorDetails)
                };
            }
        };
    }

    /**
     * @description Remove sensitive data.
     */
    removeSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
        const newObj: Record<string, unknown> = {};

        for (const key in obj) {
            let value = obj[key];
            try {
                if (isObject(value)) {
                    value = this.removeSensitiveData(value as Record<string, unknown>);
                }

                if (key.match(/pin|password|pass|key|authorization|bearer|cookie/gi)) {
                    newObj[key] = '**REDACTED**';
                } else {
                    newObj[key] = value;
                }
            } catch {
                newObj[key] = value;
            }
        }

        return newObj;
    }

    /**
     * @description Centralised log function.
     *
     * Arguments can contain lot's of different things, we prepare the arguments here.
     * This function allows us to use logging very flexible!
     *
     * logging.info('HEY', 'DU') --> is one string
     * logging.info({}, {}) --> is one object
     * logging.error(new Error()) --> is {err: new Error()}
     */
    log(type: LogLevel, args: unknown[]) {
        const modifiedMessages: unknown[] = [];
        const modifiedObject: Record<string, unknown> = {};
        const modifiedArguments: unknown[] = [];

        if (this.metadata) {
            for (const key in this.metadata) {
                modifiedObject[key] = this.metadata[key];
            }
        }

        each(args, function (value) {
            if (value instanceof Error) {
                modifiedObject.err = value;
            } else if (isObject(value)) {
                each(Object.keys(value as object), function (key) {
                    modifiedObject[key] = (value as Record<string, unknown>)[key];
                });
            } else {
                modifiedMessages.push(value);
            }
        });

        if (this.useLocalTime) {
            const currentDate = new Date();
            currentDate.setMinutes(currentDate.getMinutes() - currentDate.getTimezoneOffset());
            modifiedObject.time = currentDate.toISOString();
        }

        if (!isEmpty(modifiedObject)) {
            if (modifiedObject.err) {
                modifiedMessages.push((modifiedObject.err as Error).message);
            }
            modifiedArguments.push(modifiedObject);
        }

        modifiedArguments.push(...modifiedMessages);

        each(this.streams, (logger: StreamEntry) => {
            // If we have both a stdout and a stderr stream, don't log errors to stdout
            // because it would result in duplicate logs
            if (type === 'error' && logger.name === 'stdout' && includes(this.transports, 'stderr')) {
                return;
            }

            /**
             * @NOTE
             * Only `loggly` offers the `match` option.
             * And currently `loggly` is by default configured to only send errors (not configureable).
             * e.g. level info would get ignored.
             *
             * @NOTE
             * The `match` feature is not completed. We hardcode checking if the level/type is `error` for now.
             * Otherwise each `level:info` would has to run through the matching logic.
             *
             * @NOTE
             * Matching a string in the whole req/res object massively slows down the process, because it's a sync
             * operation.
             *
             * If we want to extend the feature, we can only offer matching certain keys e.g. status code, headers.
             * If we want to extend the feature, we have to do proper performance testing.
             *
             * `jsonStringifySafe` can match a string in an object, which has circular dependencies.
             * https://github.com/moll/json-stringify-safe
             */
            if (logger.match && type === 'error') {
                if (new RegExp(logger.match).test(jsonStringifySafe((modifiedArguments[0] as Record<string, unknown>)?.err ?? null).replace(/"/g, ''))) {
                    (logger.log[type] as unknown as (...logArgs: unknown[]) => void)(...modifiedArguments);
                }
            } else {
                (logger.log[type] as unknown as (...logArgs: unknown[]) => void)(...modifiedArguments);
            }
        });
    }

    trace(...args: unknown[]) {
        this.log('trace', toArray(args));
    }

    debug(...args: unknown[]) {
        this.log('debug', toArray(args));
    }

    info(...args: unknown[]) {
        this.log('info', toArray(args));
    }

    warn(...args: unknown[]) {
        this.log('warn', toArray(args));
    }

    error(...args: unknown[]) {
        this.log('error', toArray(args));
    }

    fatal(...args: unknown[]) {
        this.log('fatal', toArray(args));
    }

    /**
     * @description Creates a child of the logger with some properties bound for every log message
     */
    child(boundProperties: Record<string, unknown>): GhostLogger {
        const result = new GhostLogger({
            name: this.name,
            env: this.env,
            domain: this.domain,
            transports: [],
            level: this.level,
            logBody: this.logBody,
            mode: this.mode
        });

        result.streams = Object.keys(this.streams).reduce<Record<string, StreamEntry>>((acc, id) => {
            acc[id] = {
                name: this.streams[id].name,
                log: this.streams[id].log.child(boundProperties)
            };
            return acc;
        }, {});

        return result;
    }
}

export default GhostLogger;
