module.exports = require('./lib/agent');

// NOTE: exposing jest-snapshot as a part of express-test to avoid
//       version missmatching on the client side
module.exports.snapshot = {
    mochaHooks: require('@tryghost/jest-snapshot').mochaHooks,
    any: require('@tryghost/jest-snapshot').any,
    stringMatching: require('@tryghost/jest-snapshot').stringMatching
};
