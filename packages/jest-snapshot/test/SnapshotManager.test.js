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
        assert.equal(snapshotManager.willUpdate, 'new');
    });

    it('resetRegistry: will empty the registry when called', function () {
        const snapshotManager = new SnapshotManager();
        assert.deepEqual(snapshotManager.registry, {});

        snapshotManager.registry = {
            'test/my-fake.test.js': {
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
            'test/my-fake.test.js': {
                bar: 1,
                foo: 2
            }
        };

        snapshotManager.setCurrentTest({testPath: 'test/my-fake.test.js', testTitle: 'foo'});

        snapshotManager.resetRegistryForCurrentTest();
        assert.deepEqual(snapshotManager.registry, {'test/my-fake.test.js': {bar: 1}});
    });

    it('resetRegistryForCurrentTest: will not throw if no registry exists for current test', function () {
        const snapshotManager = new SnapshotManager();
        snapshotManager.setCurrentTest({testPath: 'test/my-fake.test.js', testTitle: 'foo'});

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
            snapshotManager._getNameForSnapshot('test/my-fake.test.js', 'testing bar'),
            'testing bar 1'
        );

        assert.equal(
            snapshotManager._getNameForSnapshot('test/my-fake.test.js', 'testing baz'),
            'testing baz 1'
        );

        assert.equal(
            snapshotManager._getNameForSnapshot('test/my-fake.test.js', 'testing bar'),
            'testing bar 2'
        );
    });

    it('_resolveSnapshotFilePath: will resolve the snapshot file path correctly', function () {
        const snapshotManager = new SnapshotManager();

        // Fake path with test file inside test folder
        let inputPath = '/full/path/to/tests/foo.js';
        let outputPath = snapshotManager._resolveSnapshotFilePath(inputPath);
        assert.equal(outputPath, '/full/path/to/tests/__snapshots__/foo.js.snap');

        // Fake path with test file nested beneath test folder
        inputPath = '/full/path/to/tests/unit/foo.js';
        outputPath = snapshotManager._resolveSnapshotFilePath(inputPath);
        assert.equal(outputPath, '/full/path/to/tests/unit/__snapshots__/foo.js.snap');

        // Real example mocha context
        const {test} = this;
        inputPath = test.file;
        outputPath = snapshotManager._resolveSnapshotFilePath(inputPath);
        assert.match(outputPath, /\/packages\/jest-snapshot\/test\/__snapshots__\/SnapshotManager\.test\.js\.snap/);
    });

    it('_resolveSnapshotFilePath: resolve snapshot files paths exactly the same as jest', function () {
        const snapshotManager = new SnapshotManager();

        // https://github.com/jestjs/jest/blob/main/packages/jest-snapshot/src/__tests__/SnapshotResolver.test.ts#L32-L36
        // expect(snapshotResolver.resolveSnapshotPath('/abc/cde/a.test.js')).toBe(
        //   path.join('/abc', 'cde', '__snapshots__', 'a.test.js.snap'),
        // );

        const result = snapshotManager._resolveSnapshotFilePath('/abc/cde/a.test.js');
        assert.equal(result, '/abc/cde/__snapshots__/a.test.js.snap');
    });

    it('_willUpdate: will return all when the environment variable is set', function () {
        const originalValue = process.env.SNAPSHOT_UPDATE || '';
        process.env.SNAPSHOT_UPDATE = 1;
        const snapshotManager = new SnapshotManager();
        assert.equal(snapshotManager.willUpdate, 'all');
        process.env.SNAPSHOT_UPDATE = originalValue;
    });

    it('_willUpdate: will return new when the environment variable is not set', function () {
        const originalValue = process.env.SNAPSHOT_UPDATE || '';
        process.env.SNAPSHOT_UPDATE = '';
        const snapshotManager = new SnapshotManager();
        assert.equal(snapshotManager.willUpdate, 'new');
        process.env.SNAPSHOT_UPDATE = originalValue;
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
            testPath: 'test/my-fake.test.js',
            testTitle: 'My fake test title'
        });

        let config = snapshotManager._getConfig();
        assert.equal(config.snapshotPath, 'test/__snapshots__/my-fake.test.js.snap');
        assert.equal(config.snapshotName, 'My fake test title 1');

        sinon.assert.calledOnce(nameSpy);
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

            // Ensure this doesn't result in files being written
            snapshotManager.willUpdate = 'none';

            const configStub = sinon.stub(snapshotManager, '_getConfig').returns({
                snapshotPath: 'test/__snapshots__/foo.js.snap',
                snapshotName: 'testing bar 1'
            });

            const result = snapshotManager.match({});
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.equal(typeof result.message, 'function');
            assert.match(result.message(), /testing bar 1/);
        });

        it('match can accept a name hint for failure messages', function () {
            const snapshotManager = new SnapshotManager();

            // Ensure this doesn't result in files being written
            snapshotManager.willUpdate = 'none';

            const configStub = sinon.stub(snapshotManager, '_getConfig').returns({
                snapshotPath: 'test/__snapshots__/foo.js.snap',
                snapshotName: 'testing bar 1'
            });

            const result = snapshotManager.match({}, {}, '[headers]');
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.match(result.message(), /testing bar 1:.*?\[headers\]/);
        });

        it('executes matcher without properties', function () {
            const snapshotManager = new SnapshotManager();

            // Ensure this doesn't result in files being written
            snapshotManager.willUpdate = 'none';

            const configStub = sinon.stub(snapshotManager, '_getConfig').returns({
                snapshotPath: 'test/__snapshots__/foo.js.snap',
                snapshotName: 'testing bar 1'
            });

            const result = snapshotManager.match('foo', null, '[html]');
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.equal(typeof result.message, 'function');
        });
    });
});
