const assert = require('assert/strict');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const {Client} = require('@elastic/elasticsearch');
const ElasticSearch = require('../index');
const ElasticSearchBunyan = require('../lib/ElasticSearchBunyan');

const testClientConfig = {
    node: 'http://test-elastic-client',
    auth: {
        username: 'user',
        password: 'pass'
    }
};

const indexConfig = {
    index: 'test-index',
    pipeline: 'test-pipeline'
};

describe('ElasticSearch', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('Processes client configuration', function () {
        const es = new ElasticSearch(testClientConfig);

        assert.ok(es.client);
        assert.equal(typeof es.client.index, 'function');
    });

    it('Processes index configuration', async function () {
        const testBody = {
            message: 'Test data!'
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

        await es.index({
            message: 'test'
        }, indexConfig);

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

        await es.index({
            message: 'Test data'
        }, indexConfig.index);

        assert.equal(indexStub.callCount, 1);
    });

    it('Catches index failures without throwing', async function () {
        const es = new ElasticSearch(testClientConfig);
        sandbox.stub(Client.prototype, 'index').rejects(new Error('boom'));

        await assert.doesNotReject(async () => {
            await es.index({message: 'Test data'}, indexConfig);
        });
    });
});

describe('ElasticSearch Bunyan', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('Can index using the Bunyan API', function () {
        const es = new ElasticSearchBunyan(testClientConfig, indexConfig.index, indexConfig.pipeline);

        const bulkStub = sandbox.stub(es.client.client.helpers, 'bulk').callsFake((data) => {
            assert.equal(data.pipeline, indexConfig.pipeline);
            assert.deepEqual(data.onDocument(), {
                create: {_index: indexConfig.index}
            });
        });

        const stream = es.getStream();
        stream.write(JSON.stringify({message: 'Test data'}));

        assert.equal(bulkStub.callCount, 1);
    });
});
