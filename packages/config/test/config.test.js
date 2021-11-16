// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

const initConfig = require('../lib/config');
const rootUtils = require('@tryghost/root-utils');
const process = require('process');
const sandbox = sinon.createSandbox();
const {join} = require('path');

const realRoot = rootUtils.getProcessRoot();

describe('Config', function () {
    afterEach(function () {
        sandbox.restore();
    });

    function fixturePath(path) {
        return join(realRoot, '/test/fixtures', path || '');
    }

    it('Ignition does NOT have config', function () {
        const config = initConfig(true);

        should(config.get('test')).be.undefined();
        should(config.get('should-be-used')).be.undefined();
    });

    it('loads config file', function () {
        sandbox.stub(rootUtils, 'getProcessRoot').returns(fixturePath());
        var config = initConfig(true);

        config.stores.file.file.should.endWith('config/test/fixtures/config.testing.json');
        config.get('hello').should.equal('world');
        config.get('test').should.equal('root-config');
        config.get('should-be-used').should.be.true();
    });
});
