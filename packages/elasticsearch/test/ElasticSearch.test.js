const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const { Client } = require('@elastic/elasticsearch');
const ElasticSearch = require('../index');
const ElasticSearchBunyan = require('../lib/ElasticSearchBunyan');

const EXPECTED_ELASTICSEARCH_MAJOR = 8;
const elasticsearchPackage = JSON.parse(
    fs.readFileSync(
        path.join(path.dirname(require.resolve('@elastic/elasticsearch')), 'package.json'),
        'utf8',
    ),
);

const testClientConfig = {
    node: 'http://test-elastic-client',
    auth: {
        username: 'user',
        password: 'pass',
    },
};

const indexConfig = {
    index: 'test-index',
    pipeline: 'test-pipeline',
};

describe('ElasticSearch', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it(`Uses @elastic/elasticsearch v${EXPECTED_ELASTICSEARCH_MAJOR}`, function () {
        const installedMajor = Number(elasticsearchPackage.version.split('.')[0]);
        assert.equal(
            installedMajor,
            EXPECTED_ELASTICSEARCH_MAJOR,
            `Expected @elastic/elasticsearch v${EXPECTED_ELASTICSEARCH_MAJOR}, got v${elasticsearchPackage.version}`,
        );
    });

    it('Processes client configuration', function () {
        const es = new ElasticSearch(testClientConfig);

        assert.ok(es.client);
        assert.equal(typeof es.client.index, 'function');
    });

    it('Processes index configuration', async function () {
        const testBody = {
            message: 'Test data!',
        };

        const indexStub = sandbox.stub(Client.prototype, 'index').callsFake((data) => {
            assert.ok(data.body);
            assert.deepEqual(data.body, testBody);
            assert.equal(data.index, indexConfig.index);
            assert.equal(data.pipeline, indexConfig.pipeline);
        });

        const es = new ElasticSearch(testClientConfig);
        await es.index(testBody, indexConfig);

        assert.equal(indexStub.called, true);
    });

    it('Calls index on valid events', async function () {
        const es = new ElasticSearch(testClientConfig);
        const indexStub = sandbox.stub(Client.prototype, 'index');

        await es.index(
            {
                message: 'test',
            },
            indexConfig,
        );

        assert.equal(indexStub.callCount, 1);
    });

    it('Does not index invalid events', async function () {
        const es = new ElasticSearch(testClientConfig);
        const indexStub = sandbox.stub(Client.prototype, 'index');

        await es.index('not an object', indexConfig);

        assert.equal(indexStub.callCount, 0);
    });

    it('Uses index config as a string', async function () {
        const es = new ElasticSearch(testClientConfig);
        const indexStub = sandbox.stub(Client.prototype, 'index').callsFake((data) => {
            assert.equal(data.index, indexConfig.index);
        });

        await es.index(
            {
                message: 'Test data',
            },
            indexConfig.index,
        );

        assert.equal(indexStub.callCount, 1);
    });

    it('Catches index failures without throwing', async function () {
        const es = new ElasticSearch(testClientConfig);
        sandbox.stub(Client.prototype, 'index').rejects(new Error('boom'));

        await assert.doesNotReject(async () => {
            await es.index({ message: 'Test data' }, indexConfig);
        });
    });

    it('Ships a batch of events in a single bulk request', async function () {
        const es = new ElasticSearch(testClientConfig);
        const bulkStub = sandbox.stub(Client.prototype, 'bulk').resolves({ errors: false });

        await es.bulk([
            { index: 'metrics-cache-hit', document: { value: 1 } },
            { index: 'metrics-cache-miss', document: { value: 2 } },
        ]);

        assert.equal(bulkStub.callCount, 1);
        assert.deepEqual(bulkStub.firstCall.args[0].operations, [
            { create: { _index: 'metrics-cache-hit' } },
            { value: 1 },
            { create: { _index: 'metrics-cache-miss' } },
            { value: 2 },
        ]);
    });

    it('Does not send a bulk request for an empty or invalid batch', async function () {
        const es = new ElasticSearch(testClientConfig);
        const bulkStub = sandbox.stub(Client.prototype, 'bulk');

        await es.bulk([]);
        await es.bulk(undefined);
        await es.bulk([
            { index: 'metrics-test', document: 'not an object' },
            { index: 'metrics-test', document: null },
        ]);

        assert.equal(bulkStub.callCount, 0);
    });

    it('Skips invalid documents but ships the rest of the batch', async function () {
        const es = new ElasticSearch(testClientConfig);
        const bulkStub = sandbox.stub(Client.prototype, 'bulk').resolves({ errors: false });

        await es.bulk([
            { index: 'metrics-test', document: 'not an object' },
            { index: 'metrics-test', document: { value: 1 } },
        ]);

        assert.equal(bulkStub.callCount, 1);
        assert.deepEqual(bulkStub.firstCall.args[0].operations, [
            { create: { _index: 'metrics-test' } },
            { value: 1 },
        ]);
    });

    it('Splits bulk requests by serialized size and skips oversized documents', async function () {
        const es = new ElasticSearch(testClientConfig);
        const bulkStub = sandbox.stub(Client.prototype, 'bulk').resolves({ errors: false });
        const originalByteLength = Buffer.byteLength;

        sandbox.stub(Buffer, 'byteLength').callsFake((value) => {
            if (value.includes('"size":"large"')) {
                return 60 * 1024 * 1024;
            }

            if (value.includes('"size":"oversized"')) {
                return 100 * 1024 * 1024;
            }

            return originalByteLength(value);
        });

        await es.bulk([
            { index: 'metrics-test', document: { size: 'large', value: 1 } },
            { index: 'metrics-test', document: { size: 'large', value: 2 } },
            { index: 'metrics-test', document: { size: 'oversized' } },
            { index: 'metrics-test', document: { value: 3 } },
        ]);

        assert.equal(bulkStub.callCount, 2);
        assert.deepEqual(
            bulkStub.firstCall.args[0].operations.filter((_, index) => index % 2 === 1),
            [{ size: 'large', value: 1 }],
        );
        assert.deepEqual(
            bulkStub.secondCall.args[0].operations.filter((_, index) => index % 2 === 1),
            [{ size: 'large', value: 2 }, { value: 3 }],
        );
    });

    it('Skips an unserializable bulk document without dropping its neighbours', async function () {
        const es = new ElasticSearch(testClientConfig);
        const bulkStub = sandbox.stub(Client.prototype, 'bulk').resolves({ errors: false });
        const circular = {};
        circular.self = circular;

        await es.bulk([
            { index: 'metrics-test', document: { value: 1 } },
            { index: 'metrics-test', document: circular },
            { index: 'metrics-test', document: { value: 2 } },
        ]);

        assert.equal(bulkStub.callCount, 1);
        assert.deepEqual(
            bulkStub.firstCall.args[0].operations.filter((_, index) => index % 2 === 1),
            [{ value: 1 }, { value: 2 }],
        );
    });

    it('Catches bulk failures without throwing', async function () {
        const es = new ElasticSearch(testClientConfig);
        sandbox.stub(Client.prototype, 'bulk').rejects(new Error('boom'));

        await assert.doesNotReject(async () => {
            await es.bulk([{ index: 'metrics-test', document: { value: 1 } }]);
        });
    });

    it('Does not throw on partial bulk failures', async function () {
        const es = new ElasticSearch(testClientConfig);
        sandbox.stub(Client.prototype, 'bulk').resolves({
            errors: true,
            items: [{ create: { error: { reason: 'mapper_parsing_exception' } } }, { create: {} }],
        });

        await assert.doesNotReject(async () => {
            await es.bulk([
                { index: 'metrics-test', document: { value: 'a' } },
                { index: 'metrics-test', document: { value: 1 } },
            ]);
        });
    });
});

describe('ElasticSearch Bunyan', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('Can index using the Bunyan API', function () {
        const es = new ElasticSearchBunyan(
            testClientConfig,
            indexConfig.index,
            indexConfig.pipeline,
        );

        const bulkStub = sandbox.stub(es.client.client.helpers, 'bulk').callsFake((data) => {
            assert.equal(data.pipeline, indexConfig.pipeline);
            assert.deepEqual(data.onDocument(), {
                create: { _index: indexConfig.index },
            });
        });

        const stream = es.getStream();
        stream.write(JSON.stringify({ message: 'Test data' }));

        assert.equal(bulkStub.callCount, 1);
    });

    it('flush() ends the stream and awaits the bulk request', async function () {
        const es = new ElasticSearchBunyan(
            testClientConfig,
            indexConfig.index,
            indexConfig.pipeline,
        );

        let bulkResolved = false;
        // Resolve the bulk promise only once the source stream has ended,
        // mirroring how the real helper drains its buffer.
        sandbox.stub(es.client.client.helpers, 'bulk').callsFake((data) => {
            return (async () => {
                // eslint-disable-next-line no-unused-vars
                for await (const _chunk of data.datasource) {
                    // drain the datasource
                }
                bulkResolved = true;
            })();
        });

        const stream = es.getStream();
        stream.write(JSON.stringify({ message: 'Test data' }));

        await es.flush();

        assert.equal(stream.writableEnded, true);
        assert.equal(bulkResolved, true);
    });

    it('flush() can be called more than once without re-ending the stream', async function () {
        const es = new ElasticSearchBunyan(
            testClientConfig,
            indexConfig.index,
            indexConfig.pipeline,
        );

        sandbox.stub(es.client.client.helpers, 'bulk').resolves();

        const stream = es.getStream();
        const endSpy = sandbox.spy(stream, 'end');

        await es.flush();
        await es.flush();

        assert.equal(stream.writableEnded, true);
        assert.equal(endSpy.callCount, 1);
    });

    it('flush() is a no-op when no stream was created', async function () {
        const es = new ElasticSearchBunyan(
            testClientConfig,
            indexConfig.index,
            indexConfig.pipeline,
        );

        await assert.doesNotReject(async () => {
            await es.flush();
        });
    });

    it('flush() swallows a rejected bulk request', async function () {
        const es = new ElasticSearchBunyan(
            testClientConfig,
            indexConfig.index,
            indexConfig.pipeline,
        );

        sandbox.stub(es.client.client.helpers, 'bulk').returns(Promise.reject(new Error('boom')));

        es.getStream();

        await assert.doesNotReject(async () => {
            await es.flush();
        });
    });
});
