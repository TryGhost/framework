const assert = require('assert/strict');
const {identifier} = require('../');

describe('Lib: Security - Identifier', function () {
    it('creates UID strings with requested length', function () {
        const uid = identifier.uid(24);

        assert.equal(uid.length, 24);
        assert.match(uid, /^[A-Za-z0-9]+$/);
    });
});
