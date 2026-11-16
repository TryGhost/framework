import validators = require('./lib/validator');
import validateFn = require('./lib/validate');

declare namespace validator {
    type IsLengthOptions = validators.IsLengthOptions;
    type IsEmptyOptions = validators.IsEmptyOptions;
    type IsURLOptions = validators.IsURLOptions;
    type IsEmailOptions = validators.IsEmailOptions;
    type UUIDVersion = validators.UUIDVersion;
    type IsBooleanOptions = validators.IsBooleanOptions;
    type IsIntOptions = validators.IsIntOptions;
    type IsInOptions = validators.IsInOptions;
    type Validations = validateFn.Validations;
}

declare const validator: typeof validators & {
    validate: typeof validateFn;
};

export = validator;
