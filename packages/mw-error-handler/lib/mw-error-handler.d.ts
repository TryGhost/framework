/**
 * Express middleware utilities for normalizing and rendering Ghost API
 * errors.
 *
 * Request, response and `next` parameters are typed structurally with only
 * the members each middleware uses, so Express's own `Request`, `Response`
 * and `NextFunction` types are assignable to them.
 */
declare namespace mwErrorHandler {
    /**
     * Express-style `next` callback, called with the (normalized) error.
     */
    type NextFunction = (err?: unknown) => void;

    /**
     * Header accessor shared by Express requests and responses.
     */
    type HeaderGetter = (name: string) => string | string[] | undefined;

    /**
     * Error shape read by `prepareErrorCacheControl()`: only the status code
     * is used.
     */
    type ErrorWithStatusCode = object & {
        statusCode?: number;
    };

    /**
     * Error shape read by `jsonErrorRenderer`. Ghost errors from
     * `@tryghost/errors` match it.
     */
    type RenderableError = object & {
        name?: string;
        message?: string;
        context?: string | null;
        errorType?: string | null;
        errorDetails?: unknown;
        property?: string | null;
        help?: string | null;
        code?: string | null;
        id?: string | null;
        ghostErrorCode?: string | null;
    };

    /**
     * A single entry of the JSON error response body. Missing values are
     * rendered as `null`.
     */
    interface JSONErrorItem {
        message: string | undefined;
        context: string | null;
        type: string | null;
        details: unknown;
        property: string | null;
        help: string | null;
        code: string | null;
        id: string | null;
        ghostErrorCode: string | null;
    }

    /**
     * The body passed to `res.json()` by `jsonErrorRenderer`.
     */
    interface JSONErrorBody {
        errors: [JSONErrorItem];
    }

    /**
     * Minimal Sentry integration shape: an object exposing an Express
     * error-handling (or plain) middleware.
     */
    interface SentryLike<ErrorHandler> {
        errorHandler: ErrorHandler;
    }

    /**
     * Normalize any thrown value into a Ghost error and pass it to `next()`.
     *
     * - Arrays are unwrapped to their first element.
     * - Ghost errors are passed through unchanged.
     * - 404s and bookshelf `EmptyResponse` errors become `NotFoundError`.
     * - handlebars / express-hbs errors become `IncorrectUsageError`.
     * - mysql2 errors become `ValidationError` (`ER_WRONG_VALUE`) or
     *   `InternalServerError`, with the original code kept as `sqlErrorCode`.
     * - Everything else becomes an `InternalServerError`.
     *
     * Also sets `req.err` to the normalized error (used by request logging)
     * and `res.statusCode` to its status code.
     *
     * @param err The thrown value. Must not be `null`/`undefined` or an empty
     * array.
     */
    function prepareError(
        err: NonNullable<unknown>,
        req: object,
        res: { statusCode: number },
        next: NextFunction,
    ): void;

    /**
     * Pass a clone of the error to `next()` with its stack prepared for the
     * user: only the first line in production or when `hideStack` is set,
     * otherwise marked with a `Stack Trace:` header.
     */
    function prepareStack(err: object, req: unknown, res: unknown, next: NextFunction): void;

    /**
     * Render the error as a Ghost API JSON error response via `res.json()`.
     *
     * When `req.frameOptions` has a `docName` and `method`, the message is
     * rewritten into a user-facing message describing the failed action, and
     * the original message is moved into `context`.
     *
     * @private exposed for testing; use `handleJSONResponse()` instead.
     */
    function jsonErrorRenderer(
        err: RenderableError,
        req: unknown,
        res: { json(body: JSONErrorBody): unknown },
        next: NextFunction,
    ): void;

    /**
     * Create an error middleware that sets the `Cache-Control` header and
     * passes the error on.
     *
     * @param cacheControlHeaderValue Header value to always use. When omitted
     * or empty, errors are never cached (`cacheControlValues.private`), except
     * 404s for `GET` requests that are not user-specific, which use
     * `cacheControlValues.noCacheDynamic`.
     */
    function prepareErrorCacheControl(
        cacheControlHeaderValue?: string,
    ): (
        err: ErrorWithStatusCode,
        req: { method: string; get: HeaderGetter },
        res: { get: HeaderGetter; set(headers: Record<string, string>): unknown },
        next: NextFunction,
    ) => void;

    /**
     * Pass a `NotFoundError` to `next()` for an unmatched API route.
     *
     * When both an `accept-version` request header and `res.locals.safeVersion`
     * are present, an invalid header produces a `BadRequestError` and a
     * version mismatch produces a `RequestNotAcceptableError` with code
     * `UPDATE_GHOST` or `UPDATE_CLIENT` instead.
     */
    function resourceNotFound(
        req: { headers?: Record<string, string | string[] | undefined> } | null | undefined,
        res: { locals?: { safeVersion?: string } },
        next: NextFunction,
    ): void;

    /**
     * Pass a `NotFoundError` ("Page not found") to `next()`.
     */
    function pageNotFound(req: unknown, res: unknown, next: NextFunction): void;

    /**
     * Error middleware stack for JSON APIs: prepare the error, set
     * `Cache-Control`, report to Sentry, prepare the stack and render JSON.
     * Spread or pass directly to `app.use()`.
     */
    function handleJSONResponse<ErrorHandler>(
        sentry: SentryLike<ErrorHandler>,
    ): [
        typeof prepareError,
        ReturnType<typeof prepareErrorCacheControl>,
        ErrorHandler,
        typeof prepareStack,
        typeof jsonErrorRenderer,
    ];

    /**
     * Error middleware stack for HTML responses: prepare the error, set a
     * private `Cache-Control`, report to Sentry and prepare the stack. The
     * caller is expected to add its own renderer afterwards.
     */
    function handleHTMLResponse<ErrorHandler>(
        sentry: SentryLike<ErrorHandler>,
    ): [
        typeof prepareError,
        ReturnType<typeof prepareErrorCacheControl>,
        ErrorHandler,
        typeof prepareStack,
    ];
}

export = mwErrorHandler;
