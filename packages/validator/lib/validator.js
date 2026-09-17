const _ = require('lodash');

const baseValidator = require('validator');
const assert = require('assert');

const isEmailCustom = require('./is-email');

const allowedValidators = [
    'isLength',
    'isEmpty',
    'isURL',
    'isEmail',
    'isIn',
    'isUUID',
    'isBoolean',
    'isInt',
    'isLowercase',
    'equals',
    'matches',
];

function assertString(input) {
    assert(typeof input === 'string', 'Validator validates strings only');
}

const validators = {};

allowedValidators.forEach((name) => {
    if (_.has(baseValidator, name)) {
        validators[name] = baseValidator[name];
    }
});

validators.isTimezone = function isTimezone(str) {
    assertString(str);
    // Intl also accepts UTC offsets like "+01:00"; only IANA zone names are valid here
    if (!str || /^[+-]/.test(str)) {
        return false;
    }

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: str });
        return true;
    } catch {
        return false;
    }
};

validators.isEmptyOrURL = function isEmptyOrURL(str) {
    assertString(str);
    return (
        validators.isEmpty(str) ||
        validators.isURL(str, { require_protocol: false, require_tld: false })
    );
};

validators.isSlug = function isSlug(str) {
    assertString(str);
    return validators.matches(str, /^[a-z0-9\-_]+$/);
};

validators.isEmail = function isEmail(str, options = { legacy: true }) {
    assertString(str);
    // Use the latest email validator if legacy is set to false
    if (!options?.legacy) {
        return isEmailCustom(str);
    }
    // Otherwise use the legacy email validator from the validator package
    return baseValidator.isEmail(str);
};

module.exports = validators;
