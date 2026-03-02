import assert from 'assert/strict';
import {identifier} from '../src/index.js';

describe('Lib: Security - Identifier', function () {
    it('creates UID strings with requested length', function () {
        const uid = identifier.uid(24);

        assert.equal(uid.length, 24);
        assert.match(uid, /^[A-Za-z0-9]+$/);
    });
});
