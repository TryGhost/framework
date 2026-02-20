const assert = require('assert/strict');

describe('Version index', function () {
    it('exports version implementation', function () {
        const indexExport = require('../index');
        const libExport = require('../lib/version');

        assert.equal(indexExport, libExport);
    });
});
