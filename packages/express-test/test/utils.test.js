const {assert} = require('./utils');

const {isJSON, convertKeysToLowerCase} = require('../lib/utils');

describe('Utils', function () {
    it('isJSON', function () {
        assert.equal(isJSON('application/json'), true);
        assert.equal(isJSON('application/ld+json'), true);
        assert.equal(isJSON('text/html'), false);
    });

    it('convertKeysToLowerCase', function () {
        const map = {
            prop: 'value',
            standard_Notation: 42,
            'BaZ-Header': 'qux'
        };

        const lowerCasedMap = convertKeysToLowerCase(map);

        assert.equal(map.standard_Notation, 42, 'original map is not modified');

        assert.equal(lowerCasedMap.prop, 'value');
        assert.equal(lowerCasedMap.standard_notation, 42);
        assert.equal(lowerCasedMap['baz-header'], 'qux');
    });
});
