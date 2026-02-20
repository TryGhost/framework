const assert = require('node:assert/strict');
const plugins = require('..');

describe('@tryghost/bookshelf-plugins', function () {
    it('exports all expected plugin modules', function () {
        assert.deepEqual(Object.keys(plugins).sort(), [
            'collision',
            'customQuery',
            'eagerLoad',
            'filter',
            'hasPosts',
            'includeCount',
            'order',
            'pagination',
            'search',
            'transactionEvents'
        ]);
    });

    it('exports plugin functions', function () {
        for (const key of Object.keys(plugins)) {
            assert.equal(typeof plugins[key], 'function');
        }
    });
});
