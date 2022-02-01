const {assert} = require('./utils');
const Request = require('../lib/request');

describe('Request', function () {
    it('constructor sets app and reqOptions', function () {
        const fn = () => { };
        const opts = {};
        let request = new Request(fn, opts);

        assert.equal(fn, request.app);
        assert.equal(opts, request.reqOptions);
    });
});
