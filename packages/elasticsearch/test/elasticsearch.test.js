const sinon = require('sinon');
const should = require('should');
const sandbox = sinon.createSandbox();

const {Client} = require('@elastic/elasticsearch');
const ElasticSearch = require('../index');
const ElasticSearchBunyan = require('../lib/elasticsearch-bunyan');

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

        should.exist(es.client);
        should.exist(es.client.index);
    });

    it('Processes index configuration', async function () {
        sandbox.stub(Client.prototype, 'index').callsFake((data) => {
            should.exist(data.body);
            should.deepEqual(data.body, testBody);
            should.exist(data.index);
            should.equal(data.index, indexConfig.index);
            should.exist(data.pipeline);
            should.equal(data.pipeline, indexConfig.pipeline);
        });

        const testBody = {
            message: 'Test data!'
        };

        const es = new ElasticSearch(testClientConfig);

        await es.index(testBody, indexConfig);

        Client.prototype.index.called.should.eql(true);
    });

    it('Calls index on valid events', async function () {
        const es = new ElasticSearch(testClientConfig);
        const indexStub = sandbox.stub(Client.prototype, 'index');

        await es.index({
            message: 'test!s'
        }, indexConfig);
        
        indexStub.callCount.should.equal(1);
    });

    it('Does not index invalid events', async function () {
        const es = new ElasticSearch(testClientConfig);
        const indexStub = sandbox.stub(Client.prototype, 'index');

        await es.index('not an object', indexConfig);
        
        indexStub.callCount.should.equal(0);
    });

    it('Uses index config as a string', async function () {
        const es = new ElasticSearch(testClientConfig);
        sandbox.stub(Client.prototype, 'index').callsFake((data) => {
            should.exist(data.index);
            should.equal(data.index, indexConfig.index);
        });

        await es.index({
            message: 'Test data'
        }, indexConfig.index);
    });
});

describe('ElasticSearch Bunyan', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('Sets the index config', async function () {
        const es = new ElasticSearchBunyan(testClientConfig, indexConfig);
        sandbox.stub(ElasticSearch.prototype, 'index').callsFake((_data, index) => {
            should.equal(index.index, indexConfig.index);
        });

        await es.write({message: 'Test data'});
    });

    it('Can index using the Bunyan API', async function () {
        const testMessage = {
            message: 'Test data'
        };

        const es = new ElasticSearchBunyan(testClientConfig, indexConfig);
        sandbox.stub(ElasticSearch.prototype, 'index').callsFake((data) => {
            should.deepEqual(data, testMessage);
        });

        await es.write(testMessage);
    });
});