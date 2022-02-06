const {assert} = require('./utils');

// We require the root dire
const snapshotTools = require('../');

describe('Jest Snapshot', function () {
    it('exposes a set of functions', function () {
        assert.deepEqual(Object.keys(snapshotTools), ['mochaHooks', 'matchSnapshot', 'matchSnapshotAssertion', 'any', 'anything', 'stringMatching']);
    });
});
