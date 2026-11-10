const { assert, sinon } = require('./utils');

const path = require('path');
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
                foo: 2,
            },
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
                foo: 2,
            },
        };

        snapshotManager.setCurrentTest({ testPath: 'test/my-fake.test.js', testTitle: 'foo' });

        snapshotManager.resetRegistryForCurrentTest();
        assert.deepEqual(snapshotManager.registry, { 'test/my-fake.test.js': { bar: 1 } });
    });

    it('resetRegistryForCurrentTest: will not throw if no registry exists for current test', function () {
        const snapshotManager = new SnapshotManager();
        snapshotManager.setCurrentTest({ testPath: 'test/my-fake.test.js', testTitle: 'foo' });

        assert.doesNotThrow(
            () => snapshotManager.resetRegistryForCurrentTest(),
            'should not throw if no registry exists for current test',
        );
    });

    it('setCurrentTest: results in currentTest being set', function () {
        const snapshotManager = new SnapshotManager();
        assert.deepEqual(snapshotManager.currentTest, {});

        snapshotManager.setCurrentTest({ foo: 'bar' });
        assert.deepEqual(snapshotManager.currentTest, { foo: 'bar' });
    });

    it('_getNameForSnapshot: will increment the counter for each snapshot name correctly', function () {
        const snapshotManager = new SnapshotManager();

        assert.equal(
            snapshotManager._getNameForSnapshot('test/my-fake.test.js', 'testing bar'),
            'testing bar 1',
        );

        assert.equal(
            snapshotManager._getNameForSnapshot('test/my-fake.test.js', 'testing baz'),
            'testing baz 1',
        );

        assert.equal(
            snapshotManager._getNameForSnapshot('test/my-fake.test.js', 'testing bar'),
            'testing bar 2',
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

        // Real example using current test file path
        inputPath = __filename;
        outputPath = snapshotManager._resolveSnapshotFilePath(inputPath);
        assert.match(
            outputPath,
            /\/packages\/jest-snapshot\/test\/__snapshots__\/SnapshotManager\.test\.js\.snap/,
        );
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

        assert.throws(assertFn, {
            message: 'Unable to run snapshot tests, current test was not configured',
        });
    });

    it('_getConfig: will return the correct config when a current test is set', function () {
        const snapshotManager = new SnapshotManager();
        let nameSpy = sinon.spy(snapshotManager, '_getNameForSnapshot');

        snapshotManager.setCurrentTest({
            testPath: 'test/my-fake.test.js',
            testTitle: 'My fake test title',
        });

        let config = snapshotManager._getConfig();
        assert.equal(config.snapshotPath, 'test/__snapshots__/my-fake.test.js.snap');
        assert.equal(config.snapshotName, 'My fake test title 1');

        sinon.assert.calledOnce(nameSpy);
    });

    describe('assert snapshot', function () {
        it('ok when match is a pass', function () {
            const snapshotManager = new SnapshotManager();
            const matchStub = sinon.stub(snapshotManager, 'match').returns({ pass: true });

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = { body: { foo: 'bar' } };
            const assertion = { properties: {}, field: 'body', error };

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
                pass: true,
            });

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = { body: { foo: 'bar' } };
            const assertion = {
                properties: { foo: 'bar' },
                field: 'body',
                hint: '[custom hint]',
                error,
            };

            const assertFn = () => {
                snapshotManager.assertSnapshot(response, assertion);
            };

            assert.doesNotThrow(assertFn);

            // Assert side effects, check that custom hinting works as expected
            sinon.assert.calledOnce(matchStub);
            sinon.assert.calledOnceWithExactly(
                matchStub,
                response.body,
                { foo: 'bar' },
                '[custom hint]',
            );
        });

        it('not ok when match is not a pass', function () {
            const snapshotManager = new SnapshotManager();
            sinon.stub(snapshotManager, 'match').returns({ pass: false });

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = { body: { foo: 'bar' } };
            const assertion = { properties: {}, field: 'body', error };

            const assertFn = () => {
                snapshotManager.assertSnapshot(response, assertion);
            };

            assert.throws(assertFn);
        });

        it('not ok when field not set', function () {
            const snapshotManager = new SnapshotManager();
            sinon.stub(snapshotManager, 'match').returns({ pass: false });

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = { body: { foo: 'bar' } };
            const assertion = { properties: {}, error };

            const assertFn = () => {
                snapshotManager.assertSnapshot(response, assertion);
            };

            assert.throws(assertFn, {
                message: 'Unable to match snapshot on undefined field undefined foo',
            });
        });
    });

    describe('match', function () {
        it('returns a failure when the snapshot does not match', async function () {
            const snapshotManager = new SnapshotManager();

            // Ensure this doesn't result in files being written
            snapshotManager.willUpdate = 'none';

            await snapshotManager.setCurrentTest({
                testPath: path.join(__dirname, 'foo.js'),
                testTitle: 'testing bar',
            });
            const configStub = sinon.spy(snapshotManager, '_getConfig');

            const result = snapshotManager.match({});
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.equal(typeof result.message, 'function');
            assert.match(result.message(), /testing bar 1/);
        });

        it('match can accept a name hint for failure messages', async function () {
            const snapshotManager = new SnapshotManager();

            // Ensure this doesn't result in files being written
            snapshotManager.willUpdate = 'none';

            await snapshotManager.setCurrentTest({
                testPath: path.join(__dirname, 'foo.js'),
                testTitle: 'testing bar',
            });
            const configStub = sinon.spy(snapshotManager, '_getConfig');

            const result = snapshotManager.match({}, {}, '[headers]');
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.match(result.message(), /testing bar 1:.*?\[headers\]/);
        });

        it('executes matcher without properties', async function () {
            const snapshotManager = new SnapshotManager();

            // Ensure this doesn't result in files being written
            snapshotManager.willUpdate = 'none';

            await snapshotManager.setCurrentTest({
                testPath: path.join(__dirname, 'foo.js'),
                testTitle: 'testing bar',
            });
            const configStub = sinon.spy(snapshotManager, '_getConfig');

            const result = snapshotManager.match('foo', null, '[html]');
            sinon.assert.calledOnce(configStub);
            assert.equal(result.pass, false);
            assert.equal(typeof result.message, 'function');
        });
    });

    describe('vitest snapshot engine', function () {
        const fs = require('fs');
        const os = require('os');
        const { Any, StringMatching } = require('@vitest/expect');

        let tmpDir;
        let testPath;

        beforeEach(function () {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-snapshot-'));
            testPath = path.join(tmpDir, 'my.test.js');
        });

        afterEach(function () {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('writes new snapshots in the jest-compatible format', async function () {
            const snapshotManager = new SnapshotManager();
            await snapshotManager.setCurrentTest({ testPath, testTitle: 'writes' });
            await snapshotManager.ready();

            const result = snapshotManager.match(
                { id: 'abc', quote: 'say "hi"', list: [1], when: 'x' },
                { id: new Any(String), when: new StringMatching(/x/) },
                '[body]',
            );
            assert.equal(result.pass, true);

            await snapshotManager.saveSnapshots();

            const written = fs.readFileSync(
                path.join(tmpDir, '__snapshots__', 'my.test.js.snap'),
                'utf8',
            );
            assert.equal(
                written,
                [
                    '// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing',
                    '',
                    'exports[`writes 1: [body] 1`] = `',
                    'Object {',
                    '  "id": Any<String>,',
                    '  "list": Array [',
                    '    1,',
                    '  ],',
                    '  "quote": "say \\\\"hi\\\\"",',
                    '  "when": StringMatching /x/,',
                    '}',
                    '`;',
                    '',
                ].join('\n'),
            );

            // A fresh manager matches the written file
            const second = new SnapshotManager();
            await second.setCurrentTest({ testPath, testTitle: 'writes' });
            const again = second.match(
                { id: 'def', quote: 'say "hi"', list: [1], when: 'x' },
                { id: new Any(String), when: new StringMatching(/x/) },
                '[body]',
            );
            assert.equal(again.pass, true);
        });

        it('reports a diff when the snapshot does not match', async function () {
            fs.mkdirSync(path.join(tmpDir, '__snapshots__'));
            fs.writeFileSync(
                path.join(tmpDir, '__snapshots__', 'my.test.js.snap'),
                '// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing\n\nexports[`diff 1 1`] = `\nObject {\n  "foo": "bar",\n}\n`;\n',
            );
            const snapshotManager = new SnapshotManager();
            await snapshotManager.setCurrentTest({ testPath, testTitle: 'diff' });

            const result = snapshotManager.match({ foo: 'baz' });
            assert.equal(result.pass, false);
            assert.match(result.message(), /Snapshot name: `diff 1 1`/);
            assert.match(result.message(), /Snapshot {2}- 1/);
            assert.match(result.message(), /Received {2}\+ 1/);
        });

        it('reports a diff when properties do not match', async function () {
            const snapshotManager = new SnapshotManager();
            await snapshotManager.setCurrentTest({ testPath, testTitle: 'props' });

            const result = snapshotManager.match({ id: 1 }, { id: new Any(String) }, '[body]');
            assert.equal(result.pass, false);
            assert.match(result.message(), /Snapshot name: `props 1: \[body\] 1`/);
            assert.match(result.message(), /Expected properties/);
        });

        it('throws a helpful error when the snapshot file was not loaded', function () {
            const snapshotManager = new SnapshotManager();
            snapshotManager.currentTest = { testPath, testTitle: 'not loaded' };

            assert.throws(() => snapshotManager.match({}), {
                message: 'Unable to run snapshot tests, snapshot file was not loaded',
            });
        });

        it('resetRegistryForCurrentTest lets a retried test reuse its snapshot keys', async function () {
            const snapshotManager = new SnapshotManager();
            await snapshotManager.setCurrentTest({ testPath, testTitle: 'retry' });
            assert.equal(snapshotManager.match({ attempt: 1 }).pass, true);

            // Retry: the first attempt's unsaved snapshot is discarded and the
            // retry writes under the same key instead of `retry 1 2`
            snapshotManager.resetRegistryForCurrentTest();
            assert.equal(snapshotManager.match({ attempt: 2 }).pass, true);
            await snapshotManager.saveSnapshots();

            const written = fs.readFileSync(
                path.join(tmpDir, '__snapshots__', 'my.test.js.snap'),
                'utf8',
            );
            assert.match(written, /exports\[`retry 1 1`\]/);
            assert.match(written, /"attempt": 2/);
            assert.doesNotMatch(written, /retry 1 2|"attempt": 1/);
        });
    });
});
