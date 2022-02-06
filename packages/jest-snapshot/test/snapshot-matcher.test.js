const {assert, sinon} = require('./utils');

const SnapshotMatcher = require('../lib/snapshot-matcher');

describe('Snapshot Matcher', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('constructor', function () {
        const snapshotMatcher = new SnapshotMatcher();
        assert.deepEqual(snapshotMatcher.registry, {});
        assert.deepEqual(snapshotMatcher.currentTest, {});
    });

    it('resetRegistry', function () {
        const snapshotMatcher = new SnapshotMatcher();
        assert.deepEqual(snapshotMatcher.registry, {});

        snapshotMatcher.registry = {foo: 'bar'};
        assert.deepEqual(snapshotMatcher.registry, {foo: 'bar'});

        snapshotMatcher.resetRegistry();
        assert.deepEqual(snapshotMatcher.registry, {});
    });

    it('setCurrentTest', function () {
        const snapshotMatcher = new SnapshotMatcher();
        assert.deepEqual(snapshotMatcher.currentTest, {});

        snapshotMatcher.setCurrentTest({foo: 'bar'});
        assert.deepEqual(snapshotMatcher.currentTest, {foo: 'bar'});
    });

    it('_getNameForSnapshot', function () {
        const snapshotMatcher = new SnapshotMatcher();

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

    it('_getConfig', function () {
        const snapshotMatcher = new SnapshotMatcher();

        let nameSpy = sinon.spy(snapshotMatcher, '_getNameForSnapshot');

        // If there's no currentTest...
        let config = snapshotMatcher._getConfig();
        assert.equal(config.testFile, undefined);
        assert.equal(config.snapshotName, 'undefined 1');
        assert.equal(config.willUpdate, 'new');
        sinon.assert.calledOnce(nameSpy);

        snapshotMatcher.setCurrentTest({
            filename: 'foo.js.snap',
            nameTemplate: 'testing bar'
        });

        config = snapshotMatcher._getConfig();
        assert.equal(config.testFile, 'foo.js.snap');
        assert.equal(config.snapshotName, 'testing bar 1');
        assert.equal(config.willUpdate, 'new');
        sinon.assert.calledTwice(nameSpy);

        process.env.SNAPSHOT_UPDATE = 1;
        config = snapshotMatcher._getConfig();
        assert.equal(config.testFile, 'foo.js.snap');
        assert.equal(config.snapshotName, 'testing bar 2');
        assert.equal(config.willUpdate, 'all');
        sinon.assert.calledThrice(nameSpy);

        process.env.SNAPSHOT_UPDATE = 0;
    });

    it('matchSnapshot works as expected', function () {
        const snapshotMatcher = new SnapshotMatcher();

        const configStub = sinon.stub(snapshotMatcher, '_getConfig').returns({
            testFile: 'foo.js.snap',
            snapshotName: 'testing bar 1',

            // Ensure this doesn't result in files being written
            willUpdate: 'none'
        });

        const result = snapshotMatcher.matchSnapshot({});
        sinon.assert.calledOnce(configStub);
        assert.equal(result.pass, false);
        assert.equal(typeof result.message, 'function');
    });
});
