// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');
const {getCallerRoot, getProcessRoot} = require('../index');

describe('getCallerRoot', function () {
    it('Gets the root directory of the caller', function () {
        // mocha calls the test function calls getCallerRoot
        getCallerRoot().should.endWith('mocha');
    });
});

describe('getProcessRoot', function () {
    it('Gets the root directory of the process', function () {
        // root-utils is the main module of the process
        getProcessRoot().should.endWith('root-utils');
    });
});
