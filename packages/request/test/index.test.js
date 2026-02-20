const assert = require('assert/strict');

describe('Request index', function () {
    it('exports request implementation', function () {
        const indexExport = require('../index');
        const libExport = require('../lib/request');

        assert.equal(indexExport, libExport);
    });
});
