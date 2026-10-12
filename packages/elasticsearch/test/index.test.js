const assert = require('assert/strict');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const ElasticSearch = require('../index');
const splitImplementation = require('../lib/implementation');
const LegacyElasticSearch = require('../lib/legacy/ElasticSearch');
const FetchElasticSearch = require('../lib/fetch/ElasticSearch');
const LegacyElasticSearchBunyan = require('../lib/legacy/ElasticSearchBunyan');
const FetchElasticSearchBunyan = require('../lib/fetch/ElasticSearchBunyan');

const clientConfig = {
    node: 'http://test-elastic-client',
    auth: {
        username: 'user',
        password: 'pass',
    },
};

describe('Implementation selection', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('Strips the implementation option from the client config', function () {
        assert.deepEqual(splitImplementation({ ...clientConfig, implementation: 'fetch' }), {
            name: 'fetch',
            config: clientConfig,
        });
    });

    describe('ElasticSearch', function () {
        it('Uses the legacy client by default', function () {
            const es = new ElasticSearch(clientConfig);

            assert.ok(es.implementation instanceof LegacyElasticSearch);
        });

        it('Uses the legacy client for an unknown implementation', function () {
            const es = new ElasticSearch({ ...clientConfig, implementation: 'nope' });

            assert.ok(es.implementation instanceof LegacyElasticSearch);
        });

        it('Uses fetch when configured', function () {
            const es = new ElasticSearch({ ...clientConfig, implementation: 'fetch' });

            assert.ok(es.implementation instanceof FetchElasticSearch);
        });

        it('Delegates index and bulk', async function () {
            const indexStub = sandbox.stub(FetchElasticSearch.prototype, 'index').resolves();
            const bulkStub = sandbox.stub(FetchElasticSearch.prototype, 'bulk').resolves();
            const es = new ElasticSearch({ ...clientConfig, implementation: 'fetch' });
            const operations = [{ index: 'test-index', document: { value: 1 } }];

            await es.index({ message: 'test' }, 'test-index');
            await es.bulk(operations);

            assert.deepEqual(indexStub.firstCall.args, [{ message: 'test' }, 'test-index']);
            assert.deepEqual(bulkStub.firstCall.args, [operations]);
        });
    });

    describe('BunyanStream', function () {
        it('Uses the legacy client by default', function () {
            const es = new ElasticSearch.BunyanStream(clientConfig, 'test-index', 'test-pipeline');

            assert.ok(es.implementation instanceof LegacyElasticSearchBunyan);
            assert.equal(es.implementation.index, 'test-index');
            assert.equal(es.implementation.pipeline, 'test-pipeline');
        });

        it('Uses fetch when configured', function () {
            const es = new ElasticSearch.BunyanStream(
                { ...clientConfig, implementation: 'fetch' },
                'test-index',
                'test-pipeline',
            );

            assert.ok(es.implementation instanceof FetchElasticSearchBunyan);
            assert.equal(es.implementation.index, 'test-index');
            assert.equal(es.implementation.pipeline, 'test-pipeline');
        });

        it('Delegates getStream and flush', async function () {
            const stream = {};
            const getStreamStub = sandbox
                .stub(FetchElasticSearchBunyan.prototype, 'getStream')
                .returns(stream);
            const flushStub = sandbox.stub(FetchElasticSearchBunyan.prototype, 'flush').resolves();
            const es = new ElasticSearch.BunyanStream(
                { ...clientConfig, implementation: 'fetch' },
                'test-index',
            );

            assert.equal(es.getStream(), stream);
            await es.flush();

            assert.equal(getStreamStub.callCount, 1);
            assert.equal(flushStub.callCount, 1);
        });
    });
});
