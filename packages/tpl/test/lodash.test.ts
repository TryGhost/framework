import assert from 'assert/strict';
import _ from 'lodash';
import '../src/tpl.js';

describe('Lodash Template', function () {
    it('Does not get clobbered by this lib', function () {
        assert.deepEqual(_.templateSettings.interpolate, /<%=([\s\S]+?)%>/g);
    });
});
