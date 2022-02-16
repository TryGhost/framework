const {assert} = require('./utils');

const {isJSON} = require('../lib/utils');

describe('Utils', function () {
    it('isJSON', function () {
        assert.equal(isJSON('application/json'), true);
        assert.equal(isJSON('application/ld+json'), true);
        assert.equal(isJSON('text/html'), false);
    });
});
