import assert from 'assert/strict';
import {password} from '../src/index.js';

describe('Lib: Security - Password', function () {
    it('hash plain password', function () {
        return password.hash('test')
            .then(function (hash: string) {
                assert.match(hash, /^\$2[ayb]\$.{56}$/);
            });
    });

    it('compare password', function () {
        return password.compare('test', '$2a$10$we16f8rpbrFZ34xWj0/ZC.LTPUux8ler7bcdTs5qIleN6srRHhilG')
            .then(function (valid: boolean) {
                assert.equal(valid, true);
            });
    });
});
