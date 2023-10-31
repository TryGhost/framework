const {assert, sinon} = require('./utils');

const SnapshotManager = require('../lib/SnapshotManager');

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

    it('resetRegistryForCurrentTest', function () {
        const snapshotMatcher = new SnapshotManager();
        assert.deepEqual(snapshotMatcher.registry, {});

        snapshotMatcher.registry = {file: {foo: 'bar', baz: 'qux'}};
        assert.deepEqual(snapshotMatcher.registry, {file: {foo: 'bar', baz: 'qux'}});

        snapshotMatcher.setCurrentTest({filename: 'file', nameTemplate: 'foo'});

        snapshotMatcher.resetRegistryForCurrentTest();
        assert.deepEqual(snapshotMatcher.registry, {file: {baz: 'qux'}});

        assert.doesNotThrow(() => snapshotMatcher.resetRegistryForCurrentTest(), 'should not throw if no registry exists for current test');

        snapshotMatcher.resetRegistry();
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
        assert.match(outputPath, /\/packages\/jest-snapshot\/test\/__snapshots__\/SnapshotManager\.test\.js\.snap/);
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
        assert.match(config.testFile, /\/__snapshots__\/SnapshotManager\.test\.js\.snap/);
        assert.equal(config.snapshotName, 'Snapshot Manager _getConfig 1');
        assert.equal(config.willUpdate, 'new');
        sinon.assert.calledOnce(nameSpy);

        process.env.SNAPSHOT_UPDATE = 1;
        config = snapshotMatcher._getConfig();
        assert.match(config.testFile, /\/__snapshots__\/SnapshotManager\.test\.js\.snap/);
        assert.equal(config.snapshotName, 'Snapshot Manager _getConfig 2');
        assert.equal(config.willUpdate, 'all');
        sinon.assert.calledTwice(nameSpy);

        process.env.SNAPSHOT_UPDATE = 0;
    });

    describe('assert snapshot', function () {
        it('ok when match is a pass', function () {
            const snapshotManager = new SnapshotManager();
            const matchStub = sinon.stub(snapshotManager, 'match').returns({pass: true});

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {body: {foo: 'bar'}};
            const assertion = {properties: {}, field: 'body', error};

            const assertFn = () => {
                snapshotManager.assertSnapshot(response, assertion);
            };

            assert.doesNotThrow(assertFn);

            // Assert side effects, check that hinting works as expected
            sinon.assert.calledOnce(matchStub);
            sinon.assert.calledOnceWithExactly(matchStub, response.body, {}, '[body]');
        });

        it('ok when match is a with extra properties', function () {
            const snapshotManager = new SnapshotManager();
            const matchStub = sinon.stub(snapshotManager, 'match').returns({
                message: () => 'hello',
                pass: true
            });

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {body: {foo: 'bar'}};
            const assertion = {properties: {foo: 'bar'}, field: 'body', hint: '[custom hint]', error};

            const assertFn = () => {
                snapshotManager.assertSnapshot(response, assertion);
            };

            assert.doesNotThrow(assertFn);

            // Assert side effects, check that custom hinting works as expected
            sinon.assert.calledOnce(matchStub);
            sinon.assert.calledOnceWithExactly(matchStub, response.body, {foo: 'bar'}, '[custom hint]');
        });

        it('not ok when match is not a pass', function () {
            const snapshotManager = new SnapshotManager();
            sinon.stub(snapshotManager, 'match').returns({pass: false});

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {body: {foo: 'bar'}};
            const assertion = {properties: {}, field: 'body', error};

            const assertFn = () => {
                snapshotManager.assertSnapshot(response, assertion);
            };

            assert.throws(assertFn);
        });

        it('not ok when field not set', function () {
            const snapshotManager = new SnapshotManager();
            sinon.stub(snapshotManager, 'match').returns({pass: false});

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {body: {foo: 'bar'}};
            const assertion = {properties: {}, error};

            const assertFn = () => {
                snapshotManager.assertSnapshot(response, assertion);
            };

            assert.throws(assertFn, {message: 'Unable to match snapshot on undefined field undefined foo'});
        });
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

    it('executes matcher without properties', function () {
        const snapshotMatcher = new SnapshotManager();

        const configStub = sinon.stub(snapshotMatcher, '_getConfig').returns({
            testFile: 'foo.js.snap',
            snapshotName: 'testing bar 1',

            // Ensure this doesn't result in files being written
            willUpdate: 'none'
        });

        const result = snapshotMatcher.match('foo', null, '[html]');
        sinon.assert.calledOnce(configStub);
        assert.equal(result.pass, false);
        assert.equal(typeof result.message, 'function');
    });
});
