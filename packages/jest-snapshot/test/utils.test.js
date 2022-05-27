const {assert} = require('./utils');

const {makeMessageFromMatchMessage} = require('../lib/utils');

describe('Utils', function () {
    describe('makeMessageFromMatchMessage', function () {
        it('makeMessageFromMatchMessage', function () {
            assert.equal(makeMessageFromMatchMessage('remove me\nnice test', 'substitute'), 'substitute\nnice test');
        });
    });
});
