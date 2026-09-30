import { GhostError, GhostErrorOptions } from './GhostError';
import { ValidationError } from './errors';

/**
 * Structural subset of a zod issue. Typed structurally so this package does not
 * depend on zod, and works with both zod v3 and v4 errors.
 */
export interface ZodIssueLike {
    code: string;
    path: PropertyKey[];
    message: string;
}

/** Structural subset of a `ZodError`. */
export interface ZodErrorLike {
    issues: ZodIssueLike[];
    stack?: string;
}

export interface ZodErrorDetail {
    /** Formatted path, e.g. `tags[0].name`. Empty string for the root value. */
    path: string;
    message: string;
    code: string;
}

export type GhostErrorConstructor<T extends GhostError> = new (options?: GhostErrorOptions) => T;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function formatPath(path: PropertyKey[]): string {
    return path.reduce<string>((result, key) => {
        if (typeof key === 'number') {
            return `${result}[${key}]`;
        }
        if (typeof key === 'symbol') {
            return `${result}[${String(key)}]`;
        }
        if (!IDENTIFIER.test(key)) {
            return `${result}[${JSON.stringify(key)}]`;
        }
        return result ? `${result}.${key}` : key;
    }, '');
}

function isZodIssueLike(issue: unknown): issue is ZodIssueLike {
    if (!issue || typeof issue !== 'object') {
        return false;
    }
    const { code, path, message } = issue as Record<string, unknown>;
    return typeof code === 'string' && typeof message === 'string' && Array.isArray(path);
}

/**
 * Duck-typed check for zod errors (v3 or v4) without requiring zod.
 */
export function isZodError(err: unknown): err is ZodErrorLike {
    if (!err || typeof err !== 'object') {
        return false;
    }
    const { issues } = err as Record<string, unknown>;
    return Array.isArray(issues) && issues.every(isZodIssueLike);
}

/**
 * Converts zod issues into structured details with formatted paths.
 */
export function getZodErrorDetails(issues: ZodIssueLike[]): ZodErrorDetail[] {
    return issues.map(({ path, message, code }) => ({ path: formatPath(path), message, code }));
}

/**
 * Formats zod issues as a single human-readable line, e.g.
 * `email: Invalid email; tags[0].name: Required`.
 */
export function formatZodIssues(issues: ZodIssueLike[]): string {
    return getZodErrorDetails(issues)
        .map(({ path, message }) => (path ? `${path}: ${message}` : message))
        .join('; ');
}

/**
 * Wraps a zod error in a Ghost error. Defaults to `ValidationError`; pass an error
 * class as the second argument to use another one, e.g. `IncorrectUsageError` when
 * the invalid input came from calling code rather than from a user request.
 * Options override the derived `message`, `property`, and `errorDetails`.
 */
export function fromZodError(err: ZodErrorLike, options?: GhostErrorOptions): ValidationError;
export function fromZodError<T extends GhostError>(
    err: ZodErrorLike,
    ErrorClass: GhostErrorConstructor<T>,
    options?: GhostErrorOptions,
): T;
export function fromZodError(
    err: ZodErrorLike,
    classOrOptions?: GhostErrorConstructor<GhostError> | GhostErrorOptions,
    maybeOptions?: GhostErrorOptions,
): GhostError {
    const ErrorClass = typeof classOrOptions === 'function' ? classOrOptions : ValidationError;
    const overrides = (typeof classOrOptions === 'function' ? maybeOptions : classOrOptions) ?? {};
    const details = getZodErrorDetails(err.issues);

    // Wrap a plain error rather than the ZodError itself: GhostError copies all own
    // properties of `err`, which would pull zod internals onto the Ghost error.
    const wrapped = new Error(formatZodIssues(err.issues));
    if (err.stack) {
        // ZodError messages are multi-line JSON, which breaks stack wrapping. Keep
        // only zod's frames behind a single-line header.
        const frames = err.stack.split('\n').filter((line) => /^\s+at /.test(line));
        wrapped.stack = [`ZodError: ${wrapped.message}`, ...frames].join('\n');
    }

    const derived: GhostErrorOptions = {
        message: wrapped.message || undefined,
        property: details[0]?.path || undefined,
        errorDetails: details,
        err: wrapped,
    };

    (Object.keys(overrides) as (keyof GhostErrorOptions)[]).forEach((key) => {
        if (overrides[key] !== undefined) {
            derived[key] = overrides[key];
        }
    });

    return new ErrorClass(derived);
}
