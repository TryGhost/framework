import assert from 'assert/strict';
import {secret} from '../src/index.js';

describe('Lib: Security - Secret', function () {
    it('generates a 13 byte secret if asked for a content secret', function () {
        let s = secret.create('content');
        assert.equal(typeof s, 'string');
        assert.equal(s.length, 13 * 2);
        assert.match(s, /[0-9a-z]+/);
    });

    it('generates a specific length secret if given a length', function () {
        let s = secret.create(10);
        assert.equal(typeof s, 'string');
        assert.equal(s.length, 10);
        assert.match(s, /[0-9a-z]+/);
    });

    it('generates a specific length secret if given a length even when odd', function () {
        let s = secret.create(15);
        assert.equal(typeof s, 'string');
        assert.equal(s.length, 15);
        assert.match(s, /[0-9a-z]+/);
    });

    it('generates a 32 byte secret if asked for an admin secret', function () {
        let s = secret.create('admin');
        assert.equal(typeof s, 'string');
        assert.equal(s.length, 32 * 2);
        assert.match(s, /[0-9a-z]+/);
    });

    it('generates a 32 byte secret by default', function () {
        let s = secret.create();
        assert.equal(typeof s, 'string');
        assert.equal(s.length, 32 * 2);
        assert.match(s, /[0-9a-z]+/);
    });
});
