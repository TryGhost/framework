const assert = require('assert/strict');
const security = require('../');

describe('Lib: Security - Secret', function () {
    it('generates a 13 byte secret if asked for a content secret', function () {
        let secret = security.secret.create('content');
        assert.equal(typeof secret, 'string');
        assert.equal(secret.length, 13 * 2);
        assert.match(secret, /[0-9a-z]+/);
    });

    it('generates a specific length secret if given a length', function () {
        let secret = security.secret.create(10);
        assert.equal(typeof secret, 'string');
        assert.equal(secret.length, 10);
        assert.match(secret, /[0-9a-z]+/);
    });

    it('generates a specific length secret if given a length even when odd', function () {
        let secret = security.secret.create(15);
        assert.equal(typeof secret, 'string');
        assert.equal(secret.length, 15);
        assert.match(secret, /[0-9a-z]+/);
    });

    it('generates a 32 byte secret if asked for an admin secret', function () {
        let secret = security.secret.create('admin');
        assert.equal(typeof secret, 'string');
        assert.equal(secret.length, 32 * 2);
        assert.match(secret, /[0-9a-z]+/);
    });

    it('generates a 32 byte secret by default', function () {
        let secret = security.secret.create();
        assert.equal(typeof secret, 'string');
        assert.equal(secret.length, 32 * 2);
        assert.match(secret, /[0-9a-z]+/);
    });
});
