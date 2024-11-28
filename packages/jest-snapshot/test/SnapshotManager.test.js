const {assert, sinon} = require('./utils');

const SnapshotManager = require('../lib/SnapshotManager');

describe('Snapshot Manager', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('can create a new instance', function () {
        const snapshotManager = new SnapshotManager();
        assert.deepEqual(snapshotManager.registry, {});
        assert.deepEqual(snapshotManager.currentTest, {});
    });

    it('resetRegistry: will empty the registry when called', function () {
        const snapshotManager = new SnapshotManager();
        assert.deepEqual(snapshotManager.registry, {});

        snapshotManager.registry = {
            'test.js': {
                bar: 1,
                foo: 2
            }
        };

        snapshotManager.resetRegistry();

        assert.deepEqual(snapshotManager.registry, {});
    });

    it('resetRegistry: will not throw if no registry exists', function () {
        const snapshotManager = new SnapshotManager();
        assert.doesNotThrow(() => snapshotManager.resetRegistry());
    });

    it('resetRegistryForCurrentTest: will empty the registry for the current test when called', function () {
        const snapshotManager = new SnapshotManager();
        assert.deepEqual(snapshotManager.registry, {});

        snapshotManager.registry = {
            'test.js': {
                bar: 1,
                foo: 2
            }
        };

        snapshotManager.setCurrentTest({filename: 'test.js', nameTemplate: 'foo'});

        snapshotManager.resetRegistryForCurrentTest();
        assert.deepEqual(snapshotManager.registry, {'test.js': {bar: 1}});
    });

    it('resetRegistryForCurrentTest: will not throw if no registry exists for current test', function () {
        const snapshotManager = new SnapshotManager();
        snapshotManager.setCurrentTest({filename: 'test.js', nameTemplate: 'foo'});

        assert.doesNotThrow(() => snapshotManager.resetRegistryForCurrentTest(), 'should not throw if no registry exists for current test');
    });

    it('setCurrentTest: results in currentTest being set', function () {
        const snapshotManager = new SnapshotManager();
        assert.deepEqual(snapshotManager.currentTest, {});

        snapshotManager.setCurrentTest({foo: 'bar'});
        assert.deepEqual(snapshotManager.currentTest, {foo: 'bar'});
    });

    it('_getNameForSnapshot: will increment the counter for each snapshot name correctly', function () {
        const snapshotManager = new SnapshotManager();

        assert.equal(
            snapshotManager._getNameForSnapshot('foo.js.snap', 'testing bar'),
            'testing bar 1'
        );

        assert.equal(
            snapshotManager._getNameForSnapshot('foo.js.snap', 'testing baz'),
            'testing baz 1'
        );

        assert.equal(
            snapshotManager._getNameForSnapshot('foo.js.snap', 'testing bar'),
            'testing bar 2'
        );
    });

    it('_resolveSnapshotFilePath: will resolve the snapshot file path correctly', function () {
        const snapshotManager = new SnapshotManager();

        // Fake path with test file inside test folder
        let inputPath = '/full/path/to/tests/foo.js.snap';
        let outputPath = snapshotManager._resolveSnapshotFilePath(inputPath);
        assert.equal(outputPath, '/full/path/to/tests/__snapshots__/foo.js.snap');

        // Fake path with test file nested beneath test folder
        inputPath = '/full/path/to/tests/unit/foo.js.snap';
        outputPath = snapshotManager._resolveSnapshotFilePath(inputPath);
        assert.equal(outputPath, '/full/path/to/tests/unit/__snapshots__/foo.js.snap');

        // Real example mocha context
        const {test} = this;
        inputPath = test.file + '.snap';
        outputPath = snapshotManager._resolveSnapshotFilePath(inputPath);
        assert.match(outputPath, /\/packages\/jest-snapshot\/test\/__snapshots__\/SnapshotManager\.test\.js\.snap/);
    });

    it('_getConfig: will throw if no current test is set', function () {
        const snapshotManager = new SnapshotManager();

        // If there's no currentTest...
        const assertFn = () => {
            snapshotManager._getConfig();
        };

        assert.throws(assertFn, {message: 'Unable to run snapshot tests, current test was not configured'});
    });

    it('_getConfig: will return the correct config when a current test is set', function () {
        const snapshotManager = new SnapshotManager();
        let nameSpy = sinon.spy(snapshotManager, '_getNameForSnapshot');

        snapshotManager.setCurrentTest({
            filename: 'my-fake.test.js.snap',
            nameTemplate: 'My fake test title'
        });

        let config = snapshotManager._getConfig();
        assert.equal(config.testFile, '__snapshots__/my-fake.test.js.snap');
        assert.equal(config.snapshotName, 'My fake test title 1');
        assert.equal(config.willUpdate, 'new');
        sinon.assert.calledOnce(nameSpy);
    });

    it('_getConfig: will return config with willUpdate set to all when the environment variable is set', function () {
        const snapshotManager = new SnapshotManager();
        let nameSpy = sinon.spy(snapshotManager, '_getNameForSnapshot');

        snapshotManager.setCurrentTest({
            filename: 'my-fake.test.js.snap',
            nameTemplate: 'My fake test title'
        });

        process.env.SNAPSHOT_UPDATE = 1;

        let config = snapshotManager._getConfig();
        assert.equal(config.testFile, '__snapshots__/my-fake.test.js.snap');
        assert.equal(config.snapshotName, 'My fake test title 1');
        assert.equal(config.willUpdate, 'all');
        sinon.assert.calledOnce(nameSpy);

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

    describe('match', function () {
        it('returns a failure when the snapshot does not match', function () {
            const snapshotManager = new SnapshotManager();

            const configStub = sinon.stub(snapshotManager, '_getConfig').returns({
                testFile: 'foo.js.snap',
                snapshotName: 'testing bar 1',

                // Ensure this doesn't result in files being written
                willUpdate: 'none'
            });

            const result = snapshotManager.match({});
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.equal(typeof result.message, 'function');
            assert.match(result.message(), /testing bar 1/);
        });

        it('match can accept a name hint for failure messages', function () {
            const snapshotManager = new SnapshotManager();

            const configStub = sinon.stub(snapshotManager, '_getConfig').returns({
                testFile: 'foo.js.snap',
                snapshotName: 'testing bar 1',

                // Ensure this doesn't result in files being written
                willUpdate: 'none'
            });

            const result = snapshotManager.match({}, {}, '[headers]');
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.match(result.message(), /testing bar 1:.*?\[headers\]/);
        });

        it('executes matcher without properties', function () {
            const snapshotManager = new SnapshotManager();

            const configStub = sinon.stub(snapshotManager, '_getConfig').returns({
                testFile: 'foo.js.snap',
                snapshotName: 'testing bar 1',

                // Ensure this doesn't result in files being written
                willUpdate: 'none'
            });

            const result = snapshotManager.match('foo', null, '[html]');
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.equal(typeof result.message, 'function');
        });
    });
});
