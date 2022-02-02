const {assert} = require('./utils');

const ExpectRequest = require('../lib/expect-request');

describe('ExpectRequest', function () {
    describe('Class functions', function () {
        it('constructor sets app and reqOptions', function () {
            const fn = () => { };
            const opts = {};
            const request = new ExpectRequest(fn, opts);

            assert.equal(request.app, fn);
            assert.equal(request.reqOptions, opts);
            assert.equal(request instanceof require('../lib/request'), true);
        });
    });
});
