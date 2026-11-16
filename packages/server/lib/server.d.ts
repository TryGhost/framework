import { RequestListener, Server } from 'http';

/**
 * An Express-style app: a request listener with a `set()` method.
 */
interface App extends RequestListener {
    set(setting: string, value: unknown): unknown;
}

/**
 * Create and start an HTTP server for `app`, listening on `port` on all
 * interfaces. A non-numeric port is treated as a named pipe. Exits the
 * process on `EACCES` and `EADDRINUSE`.
 */
export declare function start(app: App, port: number | string): Server;

/**
 * Stop the server started by `start()`.
 */
export declare function stop(done?: (err?: Error) => void): void;
