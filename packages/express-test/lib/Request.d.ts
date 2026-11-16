import http = require('http');
import stream = require('stream');

type RequestClass = typeof Request;

/**
 * A request that runs through an Express app in-process, without a server.
 * It is a thenable: awaiting it sends the request and resolves to the
 * response. Each `then()` call sends the request again.
 */
declare class Request {
    app: Request.App;
    reqOptions: Request.RequestOptions;
    cookieJar: Request.CookieJar;

    constructor(
        app: Request.App,
        cookieJar: Request.CookieJar,
        reqOptions?: Request.RequestOptions | Request.RequestOptionsInit,
    );

    /**
     * Add a file from disk to a `multipart/form-data` body. Call it more than
     * once to attach several files.
     */
    attach(name: string, filePath: string): this;

    /**
     * Set the request body. Objects are passed to the app as the already
     * parsed `req.body`; strings, Buffers and `form-data` instances are
     * streamed, so the app's body parsers see them.
     */
    body(body: object | string): this;

    /** Stream the request body from `readableStream` for the app's body parsers to read. */
    stream(readableStream: stream.Readable): this;

    /** Set a request header. */
    header(name: string, value: Request.HeaderValue): this;

    then<TResult1 = Request.Response, TResult2 = never>(
        onfulfilled?: ((value: Request.Response) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2>;

    /** Send the request and call back with the response. */
    finalize(callback: (error: Error | null, response?: Request.Response) => void): void;
}

declare namespace Request {
    /**
     * An app that handles Node requests, such as an Express app. Its `req` and
     * `res` get Express's request and response prototypes.
     */
    type App = (req: http.IncomingMessage, res: http.ServerResponse) => unknown;

    type HeaderValue = string | number | string[];

    /**
     * The result of awaiting a request.
     */
    interface Response {
        statusCode: number;
        headers: http.OutgoingHttpHeaders;
        /** The response body as UTF-8 text (`''` when empty). */
        text: string;
        /**
         * The parsed body for a JSON response (`''` when it is empty), and
         * `{}` for any other content type.
         */
        body: any;
        /** The underlying response, with the raw body bytes as `body`. */
        response: http.ServerResponse & { body: Buffer };
    }

    interface RequestOptionsInit {
        /** Defaults to `'GET'`. */
        method?: string;
        /** Defaults to `'/'`. */
        url?: string;
        /** Defaults to `{}`. */
        headers?: Record<string, HeaderValue>;
        body?: unknown;
    }

    class RequestOptions {
        method: string;
        url: string;
        headers: Record<string, HeaderValue>;
        body: unknown;

        constructor(options?: RequestOptionsInit);

        /** E.g. `'GET request on /posts/'`. */
        toString(): string;
    }

    /** Which cookies a request may receive. */
    interface CookieAccessInfo {
        domain?: string;
        path?: string;
        secure?: boolean;
        script?: boolean;
    }

    /** A cookie from the `cookiejar` package. */
    interface Cookie {
        name: string | null;
        value: string | null;
        /** Expiry time in ms, or `Infinity` for a session cookie. */
        expiration_date: number;
        path: string;
        domain: string | null;
        secure: boolean;
        /** Whether the cookie is `HttpOnly`. */
        noscript: boolean;
        /** The cookie as a `Set-Cookie` header value. */
        toString(): string;
        /** The cookie as `name=value`. */
        toValueString(): string;
    }

    /** A cookie jar from the `cookiejar` package. */
    interface CookieJar {
        /**
         * Store a cookie, or remove it if it has expired. Returns `false` when
         * it was expired.
         */
        setCookie(
            cookie: string | Cookie,
            requestDomain?: string,
            requestPath?: string,
        ): Cookie | Cookie[] | false;
        /** Store `Set-Cookie` header values; returns the cookies that were stored. */
        setCookies(
            cookies: string | string[],
            requestDomain?: string,
            requestPath?: string,
        ): Cookie[];
        getCookie(name: string, accessInfo: CookieAccessInfo): Cookie | undefined;
        getCookies(accessInfo: CookieAccessInfo): Cookie[] & { toValueString(): string };
    }

    const Request: RequestClass;
}

export = Request;
