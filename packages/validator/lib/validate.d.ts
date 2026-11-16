import type { ValidationError } from '@tryghost/errors';
import validators = require('./validator');

declare namespace validate {
    /**
     * The rule for one validator: `true`/`false` gives the expected result with
     * no extra arguments, an array is spread as the arguments after the value,
     * and any other value is passed as the single argument after the value.
     */
    type Rule<Args extends unknown[]> = boolean | Args | Exclude<Args[0], readonly unknown[]>;

    /**
     * Validations keyed by validator name, e.g.
     * `{isLength: {max: 191}, isEmpty: false, isIn: [['draft', 'published']]}`.
     */
    interface Validations {
        isLength?: Rule<[validators.IsLengthOptions]> | Rule<[number, number?]>;
        isEmpty?: Rule<[validators.IsEmptyOptions]>;
        isURL?: Rule<[validators.IsURLOptions]>;
        isEmail?: Rule<[validators.IsEmailOptions | null]>;
        isIn?: Rule<[validators.IsInOptions]>;
        isUUID?: Rule<[validators.UUIDVersion | null]>;
        isBoolean?: Rule<[validators.IsBooleanOptions]>;
        isInt?: Rule<[validators.IsIntOptions | null]>;
        isLowercase?: boolean;
        equals?: Rule<[string]>;
        matches?: Rule<[RegExp | string, string?]>;
        isTimezone?: boolean;
        isEmptyOrURL?: boolean;
        isSlug?: boolean;
    }
}

/**
 * Run each validation against the stringified `value`. Returns one
 * `ValidationError` per failed validation (empty when all pass), with
 * `context` set to `${tableName}.${key}`.
 */
declare function validate(
    value: unknown,
    key: string,
    validations: validate.Validations,
    tableName?: string,
): ValidationError[];

export = validate;
