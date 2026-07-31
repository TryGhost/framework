const _ = require('lodash');

const baseValidator = require('validator');
const moment = require('moment-timezone');
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
    return moment.tz.zone(str) ? true : false;
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
    // The slugs should always be normalized with NFC before being used, but some languages rely on
    // combining marks to create letters. To avoid misuse, the slugify() function only generates slugs
    // with a natural number of combining marks. Marks in the beginning of a slug means they're invalid,
    // and in the rest of the slug a maximum of three combining marks is permitted to each letter.
    return validators.matches(str, /^(?!\p{M})(?!.*[\p{Mn}\p{Mc}]{4,})[\p{L}\p{N}\p{Mn}\p{Mc} _-]+$/u);
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
