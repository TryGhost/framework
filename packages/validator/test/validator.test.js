require('./utils');

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
        should.exist(validator);

        const allMethods = validators.concat(custom).concat('validate');

        Object.keys(validator).should.eql(allMethods);
    });

    describe('Custom Validators', function () {
        it('isEmptyOrUrl filters javascript urls', function () {
            validator.isEmptyOrURL('javascript:alert(0)').should.be.false();
            validator.isEmptyOrURL('http://example.com/lol/<script>lalala</script>/').should.be.false();
            validator.isEmptyOrURL('http://example.com/lol?somequery=<script>lalala</script>').should.be.false();
            validator.isEmptyOrURL('').should.be.true();
            validator.isEmptyOrURL('http://localhost:2368').should.be.true();
            validator.isEmptyOrURL('http://example.com/test/').should.be.true();
            validator.isEmptyOrURL('http://www.example.com/test/').should.be.true();
            validator.isEmptyOrURL('http://example.com/foo?somequery=bar').should.be.true();
            validator.isEmptyOrURL('example.com/test/').should.be.true();
        });

        it('custom isEmail validator detects incorrect emails', function () {
            validator.isEmail('member@example.com').should.be.true();
            validator.isEmail('member@example.com', {legacy: false}).should.be.true();

            validator.isEmail('member@example').should.be.false();
            validator.isEmail('member@example', {legacy: false}).should.be.false();

            // old email validator doesn't detect this as invalid
            validator.isEmail('member@example.com�').should.be.true();
            // new email validator detects this as invalid
            validator.isEmail('member@example.com�', {legacy: false}).should.be.false();
        });
    });
});
