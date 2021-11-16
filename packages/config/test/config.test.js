// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

const getConfig = require('../lib/GhostConfig');
const rootUtils = require('@tryghost/root-utils');
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

    it('Empty config when no configuration file found', function () {
        const config = getConfig();

        should(config.get('test')).be.undefined();
        should(config.get('should-be-used')).be.undefined();
    });

    it('Reads configuration file when exists', function () {
        sandbox.stub(rootUtils, 'getProcessRoot').returns(fixturePath());
        var config = getConfig();

        config.stores.file.file.should.endWith('config/test/fixtures/config.testing.json');
        config.get('hello').should.equal('world');
        config.get('test').should.equal('root-config');
        config.get('should-be-used').should.be.true();
    });
});
