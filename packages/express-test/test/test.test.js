const {assert} = require('./utils');

const Test = require('../lib/test');

describe('Test', function () {
    describe('Class functions', function () {
        it('constructor sets app and reqOptions', function () {
            const fn = () => { };
            const opts = {};
            const test = new Test(fn, opts);

            assert.equal(fn, test.app);
            assert.equal(opts, test.reqOptions);
            assert.equal(test instanceof require('../lib/request'), true);
        });
    });
});
