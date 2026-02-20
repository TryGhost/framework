const assert = require('assert/strict');

describe('Server index', function () {
    it('exports server implementation', function () {
        const indexExport = require('../index');
        const libExport = require('../lib/server');

        assert.equal(indexExport, libExport);
    });
});
