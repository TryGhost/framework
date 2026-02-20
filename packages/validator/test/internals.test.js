const assert = require('assert/strict');

const validate = require('../lib/validate');
const validator = require('../lib/validator');
const isEmail = require('../lib/is-email');
const isFQDN = require('../lib/is-fqdn');
const isIP = require('../lib/is-ip');
const isByteLength = require('../lib/is-byte-length');
const assertString = require('../lib/util/assert-string');

describe('Validator internals', function () {
    describe('validate()', function () {
        it('returns no errors for valid values', function () {
            const errors = validate('abc', 'name', {isLength: {max: 10}}, 'users');
            assert.deepEqual(errors, []);
        });

        it('supports boolean validation options', function () {
            const errors = validate('ABC', 'name', {isLowercase: false}, 'users');
            assert.deepEqual(errors, []);
        });

        it('returns type-specific message for isLength', function () {
            const errors = validate('abc', 'name', {isLength: {max: 2}}, 'users');
            assert.equal(errors.length, 1);
            assert.equal(errors[0].message, 'Value in [users.name] exceeds maximum length of 2 characters.');
            assert.equal(errors[0].context, 'users.name');
        });

        it('returns default validation message for other validators', function () {
            const errors = validate('ABC', 'name', {isLowercase: true}, 'users');
            assert.equal(errors.length, 1);
            assert.equal(errors[0].message, 'Validation (isLowercase) failed for name');
            assert.equal(errors[0].context, 'users.name');
        });
    });

    describe('lib/validator custom methods', function () {
        it('isTimezone validates real timezones', function () {
            assert.equal(validator.isTimezone('Europe/London'), true);
            assert.equal(validator.isTimezone('Not/AZone'), false);
        });

        it('isSlug validates slug format', function () {
            assert.equal(validator.isSlug('a-valid_slug-1'), true);
            assert.equal(validator.isSlug('not valid slug'), false);
        });

        it('custom validators enforce string input', function () {
            assert.throws(() => validator.isTimezone(1), /Validator validates strings only/);
            assert.throws(() => validator.isSlug({}), /Validator validates strings only/);
            assert.throws(() => validator.isEmptyOrURL(null), /Validator validates strings only/);
        });
    });

    describe('is-email', function () {
        it('supports display name options', function () {
            assert.equal(isEmail('Name <member@example.com>', {allow_display_name: true}), true);
            assert.equal(isEmail('member@example.com', {require_display_name: true}), false);
            assert.equal(isEmail('" " <member@example.com>', {allow_display_name: true}), false);
            assert.equal(isEmail('Bad;Name <member@example.com>', {allow_display_name: true}), false);
            assert.equal(isEmail('"Bad"Name" <member@example.com>', {allow_display_name: true}), false);
        });

        it('supports host allow and deny lists', function () {
            assert.equal(isEmail('member@example.com', {host_blacklist: ['example.com']}), false);
            assert.equal(isEmail('member@test.com', {host_whitelist: ['example.com']}), false);
            assert.equal(isEmail('member@example.com', {host_whitelist: ['example.com']}), true);
        });

        it('supports domain specific validation and max length options', function () {
            assert.equal(isEmail('abc123@gmail.com', {domain_specific_validation: true}), true);
            assert.equal(isEmail('abc123@googlemail.com', {domain_specific_validation: true}), true);
            assert.equal(isEmail('a@gmail.com', {domain_specific_validation: true}), false);
            assert.equal(isEmail('abc_123@gmail.com', {domain_specific_validation: true}), false);
            assert.equal(isEmail(`${'a'.repeat(250)}@x.com`, {ignore_max_length: true}), true);
            assert.equal(isEmail(`${'a'.repeat(250)}@x.com`, {ignore_max_length: false}), false);
            assert.equal(isEmail(`${'a'.repeat(65)}@x.com`, {ignore_max_length: false}), false);
        });

        it('supports ip-domain and local-part options', function () {
            assert.equal(isEmail('member@127.0.0.1'), false);
            assert.equal(isEmail('member@127.0.0.1', {allow_ip_domain: true}), true);
            assert.equal(isEmail('member@[127.0.0.1]', {allow_ip_domain: true}), true);
            assert.equal(isEmail('member@[]', {allow_ip_domain: true}), false);
            assert.equal(isEmail('member@invalid_domain', {allow_ip_domain: true}), false);
            assert.equal(isEmail('"member"@example.com', {allow_utf8_local_part: false}), true);
            assert.equal(isEmail('"mémber"@example.com', {allow_utf8_local_part: true}), true);
            assert.equal(isEmail('mémber@example.com', {allow_utf8_local_part: false}), false);
            assert.equal(isEmail('member()@example.com'), false);
            assert.equal(isEmail('member@example.com', {blacklisted_chars: 'm'}), false);
            assert.equal(isEmail('member@example.com', {blacklisted_chars: 'z'}), true);
        });
    });

    describe('is-fqdn', function () {
        it('covers option branches', function () {
            assert.equal(isFQDN('example.com'), true);
            assert.equal(isFQDN('example'), false);
            assert.equal(isFQDN('example.com.', {allow_trailing_dot: true}), true);
            assert.equal(isFQDN('*.example.com'), false);
            assert.equal(isFQDN('*.example.com', {allow_wildcard: true}), true);
            assert.equal(isFQDN('my_domain.com'), false);
            assert.equal(isFQDN('my_domain.com', {allow_underscores: true}), true);
            assert.equal(isFQDN('example.123'), false);
            assert.equal(isFQDN('example.123', {allow_numeric_tld: true}), true);
            assert.equal(isFQDN('exa mple.com'), false);
            assert.equal(isFQDN('example.c om'), false);
            assert.equal(isFQDN('example.c om', {allow_numeric_tld: true}), false);
            assert.equal(isFQDN('example.123', {require_tld: false}), false);
            assert.equal(isFQDN(`${'a'.repeat(64)}.com`), false);
            assert.equal(isFQDN('ｅxample.com'), false);
            assert.equal(isFQDN('-example.com'), false);
        });
    });

    describe('is-ip', function () {
        it('supports v4, v6, and explicit version checks', function () {
            assert.equal(isIP('127.0.0.1'), true);
            assert.equal(isIP('127.0.0.1', 4), true);
            assert.equal(isIP('fe80::1234%1'), true);
            assert.equal(isIP('fe80::1234%1', 6), true);
            assert.equal(isIP('127.0.0.1', 5), false);
        });
    });

    describe('is-byte-length', function () {
        it('supports object options and legacy signature', function () {
            assert.equal(isByteLength('abc', {min: 2, max: 3}), true);
            assert.equal(isByteLength('abc', {min: 4, max: 5}), false);
            assert.equal(isByteLength('abc', 2, 3), true);
            assert.equal(isByteLength('abc', 4, 5), false);
        });
    });

    describe('assert-string', function () {
        it('accepts string values', function () {
            assert.doesNotThrow(() => assertString('hello'));
            assert.doesNotThrow(() => assertString(new String('hello')));
        });

        it('throws typed validation errors for invalid values', function () {
            assert.throws(() => assertString(null), /Expected a string but received a null/);
            assert.throws(() => assertString({}), /Expected a string but received a Object/);
            assert.throws(() => assertString(1), /Expected a string but received a number/);
        });
    });
});
