const {assert} = require('./utils');

const ExpectRequest = require('../lib/expect-request');

describe('ExpectRequest', function () {
    describe('Class functions', function () {
        it('constructor sets app, jar and reqOptions', function () {
            const fn = () => { };
            const jar = {};
            const opts = {};
            const request = new ExpectRequest(fn, jar, opts);

            assert.equal(request.app, fn);
            assert.equal(request.cookieJar, jar);
            assert.equal(request.reqOptions, opts);
        });
    });
});
