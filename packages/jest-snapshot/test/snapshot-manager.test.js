const {assert, sinon} = require('./utils');

const SnapshotManager = require('../lib/snapshot-manager');

describe('Snapshot Manager', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('constructor', function () {
        const snapshotMatcher = new SnapshotManager();
        assert.deepEqual(snapshotMatcher.registry, {});
        assert.deepEqual(snapshotMatcher.currentTest, {});
    });

    it('resetRegistry', function () {
        const snapshotMatcher = new SnapshotManager();
        assert.deepEqual(snapshotMatcher.registry, {});

        snapshotMatcher.registry = {foo: 'bar'};
        assert.deepEqual(snapshotMatcher.registry, {foo: 'bar'});

        snapshotMatcher.resetRegistry();
        assert.deepEqual(snapshotMatcher.registry, {});
    });

    it('setCurrentTest', function () {
        const snapshotMatcher = new SnapshotManager();
        assert.deepEqual(snapshotMatcher.currentTest, {});

        snapshotMatcher.setCurrentTest({foo: 'bar'});
        assert.deepEqual(snapshotMatcher.currentTest, {foo: 'bar'});
    });

    it('_getNameForSnapshot', function () {
        const snapshotMatcher = new SnapshotManager();

        assert.equal(
            snapshotMatcher._getNameForSnapshot('foo.js.snap', 'testing bar'),
            'testing bar 1'
        );

        assert.equal(
            snapshotMatcher._getNameForSnapshot('foo.js.snap', 'testing baz'),
            'testing baz 1'
        );

        assert.equal(
            snapshotMatcher._getNameForSnapshot('foo.js.snap', 'testing bar'),
            'testing bar 2'
        );
    });

    it('_resolveSnapshotFilePath', function () {
        const snapshotMatcher = new SnapshotManager();

        // Fake path with test file inside test folder
        let inputPath = '/full/path/to/tests/foo.js.snap';
        let outputPath = snapshotMatcher._resolveSnapshotFilePath(inputPath);
        assert.equal(outputPath, '/full/path/to/tests/__snapshots__/foo.js.snap');

        // Fake path with test file nested beneath test folder
        inputPath = '/full/path/to/tests/unit/foo.js.snap';
        outputPath = snapshotMatcher._resolveSnapshotFilePath(inputPath);
        assert.equal(outputPath, '/full/path/to/tests/unit/__snapshots__/foo.js.snap');

        // Real example mocha context
        const {test} = this;
        inputPath = test.file + '.snap';
        outputPath = snapshotMatcher._resolveSnapshotFilePath(inputPath);
        assert.match(outputPath, /\/framework\/packages\/jest-snapshot\/test\/__snapshots__\/snapshot-manager\.test\.js\.snap/);
    });

    it('_getConfig', function () {
        const snapshotMatcher = new SnapshotManager();

        let nameSpy = sinon.spy(snapshotMatcher, '_getNameForSnapshot');

        // If there's no currentTest...
        const assertFn = () => {
            snapshotMatcher._getConfig();
        };

        assert.throws(assertFn, {message: 'Unable to run snapshot tests, current test was not configured'});

        // Set current test from the mocha context for this test!
        const {test} = this;
        snapshotMatcher.setCurrentTest({
            filename: test.file + '.snap',
            nameTemplate: test.fullTitle()
        });

        let config = snapshotMatcher._getConfig();
        assert.match(config.testFile, /\/__snapshots__\/snapshot-manager\.test\.js\.snap/);
        assert.equal(config.snapshotName, 'Snapshot Manager _getConfig 1');
        assert.equal(config.willUpdate, 'new');
        sinon.assert.calledOnce(nameSpy);

        process.env.SNAPSHOT_UPDATE = 1;
        config = snapshotMatcher._getConfig();
        assert.match(config.testFile, /\/__snapshots__\/snapshot-manager\.test\.js\.snap/);
        assert.equal(config.snapshotName, 'Snapshot Manager _getConfig 2');
        assert.equal(config.willUpdate, 'all');
        sinon.assert.calledTwice(nameSpy);

        process.env.SNAPSHOT_UPDATE = 0;
    });

    it('match works as expected', function () {
        const snapshotMatcher = new SnapshotManager();

        const configStub = sinon.stub(snapshotMatcher, '_getConfig').returns({
            testFile: 'foo.js.snap',
            snapshotName: 'testing bar 1',

            // Ensure this doesn't result in files being written
            willUpdate: 'none'
        });

        const result = snapshotMatcher.match({});
        sinon.assert.calledOnce(configStub);
        assert.equal(result.pass, false);
        assert.equal(typeof result.message, 'function');
    });

    it('match can accept a name hint', function () {
        const snapshotMatcher = new SnapshotManager();

        const configStub = sinon.stub(snapshotMatcher, '_getConfig').returns({
            testFile: 'foo.js.snap',
            snapshotName: 'testing bar 1',

            // Ensure this doesn't result in files being written
            willUpdate: 'none'
        });

        const result = snapshotMatcher.match({}, {}, '[headers]');
        sinon.assert.calledOnce(configStub);
        assert.equal(result.pass, false);
        assert.match(result.message(), /testing bar 1:.*?\[headers\]/);
    });
});
