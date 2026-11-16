declare namespace validators {
    /** Options for `isLength`. */
    interface IsLengthOptions {
        /** Minimum length (default `0`). */
        min?: number;
        /** Maximum length (no maximum when omitted). */
        max?: number;
        /** When set, the length must also be one of these values. */
        discreteLengths?: readonly number[];
    }

    /** Options for `isEmpty`. */
    interface IsEmptyOptions {
        /** Treat whitespace-only strings as empty (default `false`). */
        ignore_whitespace?: boolean;
    }

    /** Options for `isURL`, passed through to the `validator` package. */
    interface IsURLOptions {
        protocols?: readonly string[];
        require_tld?: boolean;
        require_protocol?: boolean;
        require_host?: boolean;
        require_port?: boolean;
        require_valid_protocol?: boolean;
        allow_underscores?: boolean;
        allow_trailing_dot?: boolean;
        allow_numeric_tld?: boolean;
        allow_wildcard?: boolean;
        allow_protocol_relative_urls?: boolean;
        allow_fragments?: boolean;
        allow_query_components?: boolean;
        disallow_auth?: boolean;
        ignore_max_length?: boolean;
        validate_length?: boolean;
        max_allowed_length?: number;
        host_whitelist?: ReadonlyArray<string | RegExp>;
        host_blacklist?: ReadonlyArray<string | RegExp>;
    }

    /** Options for `isEmail`. */
    interface IsEmailOptions {
        /**
         * Use the `validator` package's email check. When the options object is
         * passed without a truthy `legacy`, Ghost's stricter email check is used
         * instead. Omitting the options argument entirely uses the legacy check.
         */
        legacy?: boolean;
    }

    /** UUID versions understood by `isUUID`. Unknown versions return `false`. */
    type UUIDVersion =
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
        | '1'
        | '2'
        | '3'
        | '4'
        | '5'
        | '6'
        | '7'
        | '8'
        | 'nil'
        | 'max'
        | 'loose'
        | 'all';

    /** Options for `isBoolean`. */
    interface IsBooleanOptions {
        /** Also accept `yes`/`no` and any letter case (default `false`). */
        loose?: boolean;
    }

    /** Options for `isInt`. */
    interface IsIntOptions {
        min?: number;
        max?: number;
        lt?: number;
        gt?: number;
        /** When `false`, reject leading zeroes such as `01`. */
        allow_leading_zeroes?: boolean;
    }

    /**
     * Values accepted by `isIn`: an array (items are stringified), an object
     * (checked for an own key), or a string (checked with `indexOf`).
     */
    type IsInOptions = readonly unknown[] | string | { readonly [key: string]: unknown };
}

/**
 * Ghost's allow-listed subset of the `validator` package plus custom
 * validators. Every validator only accepts strings: `validator` package
 * methods throw a `TypeError` and the custom ones throw an `AssertionError`
 * for other values.
 */
declare const validators: {
    isLength(str: string, options?: validators.IsLengthOptions): boolean;
    /** Backwards-compatible form: `isLength(str, min, max)`. */
    isLength(str: string, min?: number, max?: number): boolean;
    isEmpty(str: string, options?: validators.IsEmptyOptions): boolean;
    isURL(str: string, options?: validators.IsURLOptions): boolean;
    /**
     * Check an email address. Uses the `validator` package's check by default,
     * or Ghost's stricter check when `options.legacy` is not truthy.
     */
    isEmail(str: string, options?: validators.IsEmailOptions | null): boolean;
    isIn(str: string, values: validators.IsInOptions): boolean;
    /** Check for a UUID. Without a version, any of versions 1-8, nil or max match. */
    isUUID(str: string, version?: validators.UUIDVersion | null): boolean;
    isBoolean(str: string, options?: validators.IsBooleanOptions): boolean;
    isInt(str: string, options?: validators.IsIntOptions | null): boolean;
    isLowercase(str: string): boolean;
    equals(str: string, comparison: string): boolean;
    /** A string pattern is compiled with `new RegExp(pattern, modifiers)`. */
    matches(str: string, pattern: RegExp | string, modifiers?: string): boolean;
    /** Whether the string is a timezone name known to moment-timezone. */
    isTimezone(str: string): boolean;
    /** Whether the string is empty or a URL (protocol and TLD not required). */
    isEmptyOrURL(str: string): boolean;
    /** Whether the string only contains `a-z`, `0-9`, `-` and `_`. */
    isSlug(str: string): boolean;
};

export = validators;
