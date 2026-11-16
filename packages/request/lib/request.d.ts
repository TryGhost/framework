import type { IncomingHttpHeaders } from 'node:http';
import type { Readable } from 'node:stream';
import type {
    BeforeRedirectHook as GotBeforeRedirectHook,
    Method as GotMethod,
    OptionsInit,
    RequestError as GotRequestError,
    ResponseType as GotResponseType,
    RetryObject as GotRetryObject,
    Timings as GotTimings,
} from 'got' with { 'resolution-mode': 'import' };

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
    options?: request.RequestOptions & {
        resolveBodyOnly?: false;
        responseType?: 'text';
        decompress?: true;
    },
): Promise<request.Response<string>>;
declare function request<T = unknown>(
    url: string,
    options: request.RequestOptions & {
        resolveBodyOnly?: false;
        responseType: 'json';
        decompress?: true;
    },
): Promise<request.Response<T>>;
declare function request(
    url: string,
    options: request.RequestOptions & { resolveBodyOnly?: false; responseType: 'buffer' },
): Promise<request.Response<Uint8Array>>;
declare function request(
    url: string,
    options: request.RequestOptions & {
        resolveBodyOnly: true;
        responseType?: 'text';
        decompress?: true;
    },
): Promise<string>;
declare function request<T = unknown>(
    url: string,
    options: request.RequestOptions & {
        resolveBodyOnly: true;
        responseType: 'json';
        decompress?: true;
    },
): Promise<T>;
declare function request(
    url: string,
    options: request.RequestOptions & { resolveBodyOnly: true; responseType: 'buffer' },
): Promise<Uint8Array>;
/**
 * With `decompress: false`, a compressed (`content-encoding`) response body is
 * left as raw bytes whatever `responseType` says.
 */
declare function request(
    url: string,
    options: request.RequestOptions & {
        resolveBodyOnly?: false;
        responseType?: 'text';
        decompress: false;
    },
): Promise<request.Response<string | Uint8Array>>;
declare function request<T = unknown>(
    url: string,
    options: request.RequestOptions & {
        resolveBodyOnly?: false;
        responseType: 'json';
        decompress: false;
    },
): Promise<request.Response<T | Uint8Array>>;
declare function request(
    url: string,
    options: request.RequestOptions & {
        resolveBodyOnly: true;
        responseType?: 'text';
        decompress: false;
    },
): Promise<string | Uint8Array>;
declare function request<T = unknown>(
    url: string,
    options: request.RequestOptions & {
        resolveBodyOnly: true;
        responseType: 'json';
        decompress: false;
    },
): Promise<T | Uint8Array>;
/** `responseType`, `resolveBodyOnly` or `decompress` not known statically. */
declare function request(url: string, options?: request.RequestOptions): Promise<unknown>;

declare namespace request {
    type Method = GotMethod;
    type ResponseType = GotResponseType;
    type Timings = GotTimings;

    /**
     * Options passed through to got v16 (merged over Ghost's defaults), using
     * got's own option types. got rejects unknown option names. `url` is left
     * out because got rejects it in options: pass it as the first argument.
     * Callbacks that receive a response (`followRedirect`, the response and
     * error hooks, `retry.calculateDelay`) are narrowed to fields that cached
     * responses also have; see `RedirectResponse`.
     */
    interface RequestOptions extends Omit<
        OptionsInit,
        'url' | 'followRedirect' | 'hooks' | 'retry'
    > {
        /** Whether to follow redirects, or a callback deciding per redirect response. */
        followRedirect?: boolean | ((response: RedirectResponse) => boolean);
        hooks?: Hooks;
        retry?: RetryOptions;
    }

    /**
     * Options for `afterResponse`'s `retryWithMergedOptions`. That retry goes
     * to got directly, so unlike `request`'s own options it accepts `url`
     * (absolute, or relative to the current URL), which skips `request`'s URL
     * validation.
     */
    interface MergedRetryOptions extends RequestOptions {
        url?: string | URL;
    }

    /** got's hooks, with response-bearing hooks narrowed to cache-safe types. */
    interface Hooks extends Omit<
        NonNullable<OptionsInit['hooks']>,
        'afterResponse' | 'beforeRedirect' | 'beforeError' | 'beforeRetry'
    > {
        afterResponse?: Array<
            (
                response: Response<unknown>,
                retryWithMergedOptions: (options: MergedRetryOptions) => never,
            ) => Response<unknown> | PromiseLike<Response<unknown>>
        >;
        beforeRedirect?: Array<
            (
                updatedOptions: Parameters<GotBeforeRedirectHook>[0],
                response: RedirectResponse,
            ) => void | PromiseLike<void>
        >;
        beforeError?: Array<(error: HookError) => Error | PromiseLike<Error>>;
        beforeRetry?: Array<(error: HookError, retryCount: number) => void | PromiseLike<void>>;
    }

    /** got's retry options, with `calculateDelay` getting a cache-safe error. */
    interface RetryOptions extends Omit<NonNullable<OptionsInit['retry']>, 'calculateDelay'> {
        calculateDelay?: (
            retryObject: Omit<GotRetryObject, 'error'> & { error: HookError },
        ) => number | PromiseLike<number>;
    }

    /**
     * A got error as hooks and `retry.calculateDelay` see it: before
     * `request` copies the response fields onto it, and with `response`
     * narrowed to a cache-safe `ErrorResponse`.
     */
    interface HookError extends Omit<GotRequestError, 'response'> {
        readonly response?: ErrorResponse;
    }

    /**
     * Response fields got sets on every response, including redirect
     * responses passed to `followRedirect` (which have no body yet). Responses
     * are usually Node `IncomingMessage`-like streams, but a cache hit (with
     * the `cache` option) is a plain readable stream with only these fields,
     * so members such as `socket` or `httpVersion` are not part of this type.
     */
    interface RedirectResponse extends Readable {
        statusCode: number;
        statusMessage?: string;
        headers: IncomingHttpHeaders;
        complete: boolean;
        /** The URL of this response. */
        url: string;
        requestUrl: URL;
        redirectUrls: URL[];
        isFromCache: boolean;
        /** Not set for responses served from the cache. */
        ip?: string;
        retryCount: number;
        /** Not set for responses served from the cache. */
        timings?: Timings;
        /** The got request that produced this response. */
        request: {
            options: {
                method: string;
                headers: Record<string, string | string[] | undefined>;
                [option: string]: unknown;
            };
        };
    }

    /** A got response, with its body. See `RedirectResponse` for caveats. */
    interface Response<Body = string> extends RedirectResponse {
        /** Parsed body, depending on `responseType` and `decompress`. */
        body: Body;
        rawBody: Uint8Array;
        /** The final URL, after redirects. */
        url: string;
        /**
         * Whether the response is 2xx, or a 3xx that was not followed. Not
         * set yet when a redirect response reaches `followRedirect`.
         */
        ok: boolean;
    }

    /**
     * The `response` on an error. The body may be missing: when the
     * connection fails or times out while reading the body, got keeps the
     * response without `body` or `rawBody`.
     */
    interface ErrorResponse extends RedirectResponse {
        body?: unknown;
        rawBody?: Uint8Array;
        ok?: boolean;
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
        response?: ErrorResponse;
    }
}

export = request;
