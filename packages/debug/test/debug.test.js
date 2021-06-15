// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');
const debug = require('../index');

describe('debug', function () {
    it('Outputs the correct module name', function () {
        debug('test').namespace.should.eql('@tryghost/debug:test');
    });
});
