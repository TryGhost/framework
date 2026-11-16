import type { Agent as HttpAgent, IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { Agent as HttpsAgent } from 'node:https';
import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import type { SecureContextOptions } from 'node:tls';

/**
 * Make an HTTP request with `got`, after validating `url` and applying Ghost's
 * defaults (a `Ghost/<version>` user-agent, `GET`, and a cached DNS lookup).
 * `method` defaults to `POST` when `body` or `json` is set, and retries are
 * disabled in test environments unless `retry` is given. `options` is mutated
 * to apply those two defaults.
 *
 * Rejects with an `InternalServerError` (`code: 'URL_MISSING_INVALID'`) when
 * `url` is not a valid URL string, and otherwise with got's errors, with the
 * response fields (`statusCode`, `body`, `headers`, ...) copied onto the error
 * when there is a response. See `request.RequestError`.
 */
declare function request(
    url: string,
    options?: request.RequestOptions & { resolveBodyOnly?: false; responseType?: 'text' },
): Promise<request.Response<string>>;
declare function request<T = unknown>(
    url: string,
    options: request.RequestOptions & { resolveBodyOnly?: false; responseType: 'json' },
): Promise<request.Response<T>>;
declare function request(
    url: string,
    options: request.RequestOptions & { resolveBodyOnly?: false; responseType: 'buffer' },
): Promise<request.Response<Uint8Array>>;
declare function request(
    url: string,
    options: request.RequestOptions & { resolveBodyOnly: true; responseType?: 'text' },
): Promise<string>;
declare function request<T = unknown>(
    url: string,
    options: request.RequestOptions & { resolveBodyOnly: true; responseType: 'json' },
): Promise<T>;
declare function request(
    url: string,
    options: request.RequestOptions & { resolveBodyOnly: true; responseType: 'buffer' },
): Promise<Uint8Array>;
/** `responseType` or `resolveBodyOnly` not known statically. */
declare function request(url: string, options?: request.RequestOptions): Promise<unknown>;

declare namespace request {
    type Method =
        | 'GET'
        | 'POST'
        | 'PUT'
        | 'PATCH'
        | 'HEAD'
        | 'DELETE'
        | 'OPTIONS'
        | 'TRACE'
        | 'QUERY'
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'head'
        | 'delete'
        | 'options'
        | 'trace'
        | 'query'
        | (string & {});

    type ResponseType = 'text' | 'json' | 'buffer';

    /** Per-phase timeouts in milliseconds. got rejects a plain number. */
    interface Timeouts {
        lookup?: number;
        socket?: number;
        connect?: number;
        secureConnect?: number;
        send?: number;
        response?: number;
        read?: number;
        request?: number;
    }

    /** got retry options. got rejects a plain number. */
    interface RetryOptions {
        limit?: number;
        methods?: Method[];
        statusCodes?: number[];
        errorCodes?: string[];
        calculateDelay?: (retryObject: {
            attemptCount: number;
            error: RequestError;
            computedValue: number;
            retryAfter?: number;
        }) => number | Promise<number>;
        backoffLimit?: number;
        noise?: number;
        maxRetryAfter?: number;
        enforceRetryRules?: boolean;
    }

    /** got hook arrays. Hook arguments are got internals and are not modelled. */
    interface Hooks {
        init?: Array<(...args: any[]) => unknown>;
        beforeRequest?: Array<(...args: any[]) => unknown>;
        beforeRedirect?: Array<(...args: any[]) => unknown>;
        beforeError?: Array<(...args: any[]) => unknown>;
        beforeRetry?: Array<(...args: any[]) => unknown>;
        beforeCache?: Array<(...args: any[]) => unknown>;
        afterResponse?: Array<(...args: any[]) => unknown>;
    }

    /** got TLS options. */
    interface HttpsOptions {
        alpnProtocols?: string[];
        rejectUnauthorized?: boolean;
        checkServerIdentity?: (hostname: string, certificate: unknown) => Error | undefined;
        serverName?: string;
        certificateAuthority?: SecureContextOptions['ca'];
        key?: SecureContextOptions['key'];
        certificate?: SecureContextOptions['cert'];
        passphrase?: SecureContextOptions['passphrase'];
        pfx?: SecureContextOptions['pfx'];
        ciphers?: SecureContextOptions['ciphers'];
        honorCipherOrder?: SecureContextOptions['honorCipherOrder'];
        minVersion?: SecureContextOptions['minVersion'];
        maxVersion?: SecureContextOptions['maxVersion'];
        signatureAlgorithms?: SecureContextOptions['sigalgs'];
        tlsSessionLifetime?: SecureContextOptions['sessionTimeout'];
        dhparam?: SecureContextOptions['dhparam'];
        ecdhCurve?: SecureContextOptions['ecdhCurve'];
        certificateRevocationLists?: SecureContextOptions['crl'];
        secureOptions?: number;
    }

    /**
     * Options passed through to got v16 (merged over Ghost's defaults). got
     * rejects unknown option names, so only got's options are accepted. `url`
     * is not an option: pass it as the first argument.
     */
    interface RequestOptions {
        method?: Method;
        headers?: Record<string, string | string[] | number | undefined>;
        searchParams?:
            | string
            | URLSearchParams
            | Record<string, string | number | boolean | null | undefined>;
        /** Request body. `method` defaults to `POST` when set. */
        body?:
            | string
            | Uint8Array
            | ArrayBufferView
            | Readable
            | Iterable<unknown>
            | AsyncIterable<unknown>
            | FormData;
        /** JSON request body. `method` defaults to `POST` when set. */
        json?: unknown;
        /** URL-encoded request body. Needs a `method` that allows a body. */
        form?: Record<string, unknown>;
        responseType?: ResponseType;
        /** Resolve with the response body instead of the response. */
        resolveBodyOnly?: boolean;
        encoding?: BufferEncoding;
        timeout?: Timeouts;
        retry?: RetryOptions;
        hooks?: Hooks;
        followRedirect?: boolean | ((response: IncomingMessage) => boolean);
        maxRedirects?: number;
        methodRewriting?: boolean;
        throwHttpErrors?: boolean;
        allowGetBody?: boolean;
        decompress?: boolean;
        prefixUrl?: string | URL;
        allowAbsoluteUrls?: boolean;
        username?: string;
        password?: string;
        signal?: AbortSignal;
        context?: Record<string, unknown>;
        agent?: { http?: HttpAgent | false; https?: HttpsAgent | false; http2?: unknown };
        https?: HttpsOptions;
        http2?: boolean;
        h2session?: unknown;
        dnsLookup?: LookupFunction;
        dnsCache?: unknown;
        dnsLookupIpVersion?: 4 | 6;
        localAddress?: string;
        cache?: string | boolean | object;
        cacheOptions?: {
            shared?: boolean;
            cacheHeuristic?: number;
            immutableMinTimeToLive?: number;
            ignoreCargoCult?: boolean;
        };
        cookieJar?: {
            getCookieString: (...args: any[]) => unknown;
            setCookie: (...args: any[]) => unknown;
        };
        ignoreInvalidCookies?: boolean;
        parseJson?: (text: string) => unknown;
        stringifyJson?: (object: unknown) => string;
        request?: (...args: any[]) => unknown;
        createConnection?: (...args: any[]) => unknown;
        copyPipedHeaders?: boolean;
        setHost?: boolean;
        maxHeaderSize?: number;
        enableUnixSockets?: boolean;
        strictContentLength?: boolean;
    }

    /** Request timing information, in milliseconds since the epoch. */
    interface Timings {
        start: number;
        socket?: number;
        lookup?: number;
        connect?: number;
        secureConnect?: number;
        upload?: number;
        response?: number;
        end?: number;
        error?: number;
        abort?: number;
        phases: {
            wait?: number;
            dns?: number;
            tcp?: number;
            tls?: number;
            request?: number;
            firstByte?: number;
            download?: number;
            total?: number;
        };
    }

    /** A got response: Node's `IncomingMessage` plus got's fields. */
    interface Response<Body = string> extends IncomingMessage {
        /** Parsed body, depending on `responseType`. */
        body: Body;
        rawBody: Uint8Array;
        statusCode: number;
        statusMessage: string;
        /** The final URL, after redirects. */
        url: string;
        requestUrl: URL;
        redirectUrls: URL[];
        ok: boolean;
        isFromCache: boolean;
        ip?: string;
        retryCount: number;
        timings: Timings;
        /** The got request that produced this response. */
        request: {
            options: {
                method: string;
                headers: Record<string, string | string[] | undefined>;
                [option: string]: unknown;
            };
        };
    }

    /**
     * Shape of the errors `request` rejects with: got's `RequestError`
     * subclasses (with the response fields copied on when there was a
     * response), or Ghost's `InternalServerError` for an invalid URL.
     */
    interface RequestError extends Error {
        /** got error code (e.g. `ERR_NON_2XX_3XX_RESPONSE`, `ETIMEDOUT`), or `URL_MISSING_INVALID`. */
        code?: string;
        statusCode?: number;
        statusMessage?: string;
        headers?: IncomingHttpHeaders;
        body?: unknown;
        rawBody?: Uint8Array;
        url?: string;
        timings?: Timings;
        response?: Response<unknown>;
    }
}

export = request;
