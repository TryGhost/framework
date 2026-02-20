const assert = require('assert/strict');

const validator = require('../');

const validators = ['isLength',
    'isEmpty',
    'isURL',
    'isEmail',
    'isIn',
    'isUUID',
    'isBoolean',
    'isInt',
    'isLowercase',
    'equals',
    'matches'
];

const custom = ['isTimezone', 'isEmptyOrURL', 'isSlug'];

describe('Validator', function () {
    it('should export our required functions', function () {
        assert.ok(validator);

        const allMethods = validators.concat(custom).concat('validate');

        assert.deepEqual(Object.keys(validator), allMethods);
    });

    describe('Custom Validators', function () {
        it('isEmptyOrUrl filters javascript urls', function () {
            assert.equal(validator.isEmptyOrURL('javascript:alert(0)'), false);
            assert.equal(validator.isEmptyOrURL('http://example.com/lol/<script>lalala</script>/'), false);
            assert.equal(validator.isEmptyOrURL('http://example.com/lol?somequery=<script>lalala</script>'), false);
            assert.equal(validator.isEmptyOrURL(''), true);
            assert.equal(validator.isEmptyOrURL('http://localhost:2368'), true);
            assert.equal(validator.isEmptyOrURL('http://example.com/test/'), true);
            assert.equal(validator.isEmptyOrURL('http://www.example.com/test/'), true);
            assert.equal(validator.isEmptyOrURL('http://example.com/foo?somequery=bar'), true);
            assert.equal(validator.isEmptyOrURL('example.com/test/'), true);
        });

        it('custom isEmail validator detects incorrect emails', function () {
            assert.equal(validator.isEmail('member@example.com'), true);
            assert.equal(validator.isEmail('member@example.com', {legacy: false}), true);

            assert.equal(validator.isEmail('member@example'), false);
            assert.equal(validator.isEmail('member@example', {legacy: false}), false);

            // old email validator doesn't detect this as invalid
            assert.equal(validator.isEmail('member@example.com�'), true);
            // new email validator detects this as invalid
            assert.equal(validator.isEmail('member@example.com�', {legacy: false}), false);
        });
    });
});
