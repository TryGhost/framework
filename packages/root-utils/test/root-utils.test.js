// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');
const path = require('path');
const fs = require('fs');
const {getCallerRoot, getProcessRoot, getGhostRoot} = require('../index');

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

describe('getGhostRoot', function () {
    it('Gets the `current` root directory of the process', function () {
        fs.mkdirSync('current');
        fs.closeSync(fs.openSync(path.join('current', 'package.json'), 'w'));

        // `current` directory contains a package.json, and is picked over `root-utils`
        getGhostRoot().should.endWith('current');

        fs.unlinkSync(path.join('current', 'package.json'));
        fs.rmdirSync('current');
    });

    it('Gets the root when no `current` directory exists', function () {
        getGhostRoot().should.endWith('root-utils');
    });
});
