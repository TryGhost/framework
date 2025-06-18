// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

const getConfig = require('../lib/get-config');
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

        config.get('hello').should.equal('world');
        config.get('test').should.equal('root-config');
        config.get('should-be-used').should.be.true();
    });

    it('Reads JSONC configuration files with comments', function () {
        // Create a separate fixture directory for JSONC testing
        const fs = require('fs');
        const path = require('path');
        const jsoncFixturePath = fixturePath('jsonc');
        
        // Clean up and create directory
        if (fs.existsSync(jsoncFixturePath)) {
            fs.rmSync(jsoncFixturePath, {recursive: true, force: true});
        }
        fs.mkdirSync(jsoncFixturePath, {recursive: true});
        
        // Copy existing JSONC fixtures to the test directory
        fs.copyFileSync(fixturePath('config.example.jsonc'), path.join(jsoncFixturePath, 'config.example.jsonc'));
        fs.copyFileSync(fixturePath('config.testing.jsonc'), path.join(jsoncFixturePath, 'config.testing.jsonc'));
        
        sandbox.stub(rootUtils, 'getProcessRoot').returns(jsoncFixturePath);
        var config = getConfig();

        config.get('hello').should.equal('world');
        config.get('test').should.equal('root-config-jsonc');
        config.get('should-be-used').should.be.true();
        config.get('jsonc').should.be.true();
        config.get('jsonc-feature').should.equal('enabled');
        
        // Clean up
        fs.rmSync(jsoncFixturePath, {recursive: true, force: true});
    });

    it('Prefers JSON files over JSONC files when both exist for backward compatibility', function () {
        const fs = require('fs');
        const path = require('path');
        const mixedFixturePath = fixturePath('mixed');
        
        // Clean up and create directory
        if (fs.existsSync(mixedFixturePath)) {
            fs.rmSync(mixedFixturePath, {recursive: true, force: true});
        }
        fs.mkdirSync(mixedFixturePath, {recursive: true});
        
        // Create both JSON and JSONC files
        fs.copyFileSync(fixturePath('config.testing.json'), path.join(mixedFixturePath, 'config.testing.json'));
        fs.copyFileSync(fixturePath('config.testing.jsonc'), path.join(mixedFixturePath, 'config.testing.jsonc'));
        
        sandbox.stub(rootUtils, 'getProcessRoot').returns(mixedFixturePath);
        var config = getConfig();

        // Should load from JSON file for backward compatibility (has "root-config" value)
        config.get('test').should.equal('root-config');
        config.get('should-be-used').should.be.true();
        should(config.get('jsonc-feature')).be.undefined();
        
        // Clean up
        fs.rmSync(mixedFixturePath, {recursive: true, force: true});
    });
});
