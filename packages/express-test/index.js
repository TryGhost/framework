module.exports = require('./lib/Agent');

// NOTE: exposing jest-snapshot as a part of express-test to avoid
//       version mismatching on the client side
module.exports.snapshot = {
    mochaHooks: require('@tryghost/jest-snapshot').mochaHooks,
    snapshotManager: require('@tryghost/jest-snapshot').snapshotManager,
    matchSnapshotAssertion: require('@tryghost/jest-snapshot').matchSnapshotAssertion,
    any: require('@tryghost/jest-snapshot').any,
    stringMatching: require('@tryghost/jest-snapshot').stringMatching
};
