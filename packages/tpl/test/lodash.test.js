const assert = require('assert/strict');

describe('Lodash Template', function () {
    it('Does not get clobbered by this lib', function () {
        require('../lib/tpl');
        let _ = require('lodash');

        // @ts-ignore
        assert.deepEqual(_.templateSettings.interpolate, /<%=([\s\S]+?)%>/g);
    });
});
