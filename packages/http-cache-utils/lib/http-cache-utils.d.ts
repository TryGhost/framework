/**
 * Minimal request/response shape: anything with an Express-style `get()`
 * header accessor.
 */
interface HeaderGetter {
    get(name: string): string | string[] | undefined;
}

/**
 * Whether the request or response carries user-specific data (a cookie or
 * authorization header on the request, or a `set-cookie` on the response).
 * Returns the first matching header value, or a falsy value.
 */
export declare function isReqResUserSpecific(
    req?: HeaderGetter | null,
    res?: HeaderGetter | null,
): string | string[] | undefined;

/**
 * Cache-Control header values used in Ghost.
 */
export declare const cacheControlValues: {
    /** Never cache in any type of cache. */
    private: string;
    /** Never cache, except in a shared cache. */
    noCacheDynamic: string;
};
