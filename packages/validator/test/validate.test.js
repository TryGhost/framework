const assert = require('assert/strict');

const validator = require('../');

// Validate our customizations
describe('Validate', function () {
    it('should export our required functions', function () {
        assert.ok(validator);
        assert.ok(Object.prototype.hasOwnProperty.call(validator, 'validate'));
        assert.equal(typeof validator.validate, 'function');
    });
});
