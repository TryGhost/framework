const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const assert = require('assert/strict');
const ElasticSearch = require('@tryghost/elasticsearch');
const PrettyStream = require('@tryghost/pretty-stream');
const { getProcessRoot } = require('@tryghost/root-utils');
const GhostMetrics = require('../lib/GhostMetrics');
const sandbox = sinon.createSandbox();

// Vitest sets process.env.MODE to 'test' which interferes with GhostMetrics mode detection
const originalMode = process.env.MODE;
beforeEach(function () {
    delete process.env.MODE;
});
afterEach(function () {
    if (originalMode !== undefined) {
        process.env.MODE = originalMode;
    } else {
        delete process.env.MODE;
    }
});

const loggingConfigPath = path.join(getProcessRoot(), 'loggingrc');

describe('Metrics config', function () {
    afterEach(function () {
        delete require.cache[require.resolve('../lib/metrics')];
        delete require.cache[require.resolve('../index')];
        delete require.cache[loggingConfigPath];
        delete require.cache[`${loggingConfigPath}.js`];
    });

    it('Reads file called loggingrc.js', function () {
        const transports = ['stdout'];
        const loggingRc = `module.exports = {
            metrics: {
                transports: [${transports.map((t) => `'${t}'`).join(', ')}]
            }
        };`;

        fs.writeFileSync('loggingrc.js', loggingRc);

        const ghostMetrics = require('../index');
        assert.deepEqual(ghostMetrics.transports, transports);

        fs.unlinkSync('loggingrc.js');
    });

    it('loads with empty config when loggingrc.js is missing', function () {
        if (fs.existsSync('loggingrc.js')) {
            fs.unlinkSync('loggingrc.js');
        }
        delete require.cache[loggingConfigPath];
        delete require.cache[`${loggingConfigPath}.js`];

        const ghostMetrics = require('../lib/metrics');
        assert.deepEqual(ghostMetrics.transports, []);
    });
});

describe('Logging', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('stdout transport works', async function () {
        const name = 'test-metric';
        const value = 101;

        await new Promise((resolve) => {
            sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
                assert.notEqual(data.msg, undefined);
                assert.equal(data.msg, `Metric ${name}: ${JSON.stringify(value)}`);
                resolve();
            });

            const ghostMetrics = new GhostMetrics({
                metrics: {
                    transports: ['stdout'],
                },
            });
            ghostMetrics.metric(name, value);
        });
    });

    it('elasticsearch transport works', async function () {
        const name = 'test-metric';
        const value = 101;

        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['elasticsearch'],
                metadata: {
                    id: '123123',
                },
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                level: 'info',
            },
        });

        await new Promise((resolve) => {
            sandbox.stub(ElasticSearch.prototype, 'index').callsFake(function (data, index) {
                assert.notEqual(data.metadata, undefined);
                assert.equal(data.metadata.id, ghostMetrics.metadata.id);
                assert.equal(data.value, value);

                // ElasticSearch shipper prefixes metric names to avoid polluting index namespace
                assert.equal(index, 'metrics-' + name);
                resolve();
            });

            ghostMetrics.metric(name, value);
        });
    });

    it('throws for invalid transport', function () {
        assert.throws(() => {
            new GhostMetrics({
                metrics: {
                    transports: ['not-a-transport'],
                },
            });
        });
    });

    it('defaults to short mode', function () {
        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['stdout'],
            },
        });

        assert.equal(ghostMetrics.mode, 'short');
    });

    it('uses long mode when LOIN variable set', function () {
        process.env.LOIN = 'set';
        const ghostMetrics = new GhostMetrics({});

        assert.equal(ghostMetrics.mode, 'long');
        delete process.env.LOIN;
    });

    it('defaults options bag and metrics transport values', function () {
        const noOptionsMetrics = new GhostMetrics();
        assert.deepEqual(noOptionsMetrics.transports, []);

        const emptyMetricsConfig = new GhostMetrics({ metrics: {} });
        assert.deepEqual(emptyMetricsConfig.transports, []);
        assert.deepEqual(emptyMetricsConfig.metadata, {});
    });

    it('resolves even when transport throws', async function () {
        const name = 'test-metric';
        const value = 101;

        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['elasticsearch'],
                metadata: {
                    id: '123123',
                },
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                level: 'info',
            },
        });

        sandbox.stub(ElasticSearch.prototype, 'index').rejects();

        await assert.doesNotReject(() => ghostMetrics.metric(name, value));
    });

    it('passes configured proxy to elasticsearch', function () {
        const name = 'proxy-metric';
        const value = 2;

        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['elasticsearch'],
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                proxy: 'https://proxy.example.com',
            },
        });

        sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        ghostMetrics.metric(name, value);
        assert.equal(ElasticSearch.prototype.index.calledOnce, true);
    });

    it('ships object values with pre-set timestamp without adding metadata when disabled', async function () {
        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['elasticsearch'],
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
            },
        });

        // Force metadata check false branch for coverage.
        ghostMetrics.metadata = null;

        const payload = {
            value: 101,
            '@timestamp': 12345,
        };

        await new Promise((resolve) => {
            sandbox.stub(ElasticSearch.prototype, 'index').callsFake(function (data, index) {
                assert.deepEqual(data, payload);
                assert.equal(index, 'metrics-object-metric');
                resolve();
            });

            ghostMetrics.metric('object-metric', payload);
        });
    });
});

describe('Sampling', function () {
    afterEach(function () {
        sandbox.restore();
    });

    function elasticsearchMetrics(metricsOptions) {
        return new GhostMetrics({
            metrics: {
                transports: ['elasticsearch'],
                ...metricsOptions,
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
            },
        });
    }

    it('defaults to shipping everything', function () {
        assert.equal(new GhostMetrics().sampleRate, 1);
        assert.deepEqual(Object.keys(new GhostMetrics().sampleRates), []);

        const configured = new GhostMetrics({ metrics: {} });
        assert.equal(configured.sampleRate, 1);
        assert.deepEqual(Object.keys(configured.sampleRates), []);
    });

    it('treats a null metrics config as an absent one', function () {
        const ghostMetrics = new GhostMetrics({ metrics: null });

        assert.deepEqual(ghostMetrics.transports, []);
        assert.deepEqual(ghostMetrics.metadata, {});
        assert.equal(ghostMetrics.sampleRate, 1);
        assert.deepEqual(Object.keys(ghostMetrics.sampleRates), []);
    });

    it('honours a rate configured for a metric named __proto__', async function () {
        // Built without a literal, since `__proto__` in one sets the prototype instead of a key
        const sampleRates = JSON.parse('{"__proto__": 0.5}');
        const ghostMetrics = elasticsearchMetrics({ sampleRates });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0.9);

        assert.equal(ghostMetrics.getSampleRate('__proto__'), 0.5);

        await ghostMetrics.metric('__proto__', 101);
        assert.equal(index.called, false);
    });

    it('does not treat a polluted prototype property as a configured rate', function () {
        const ghostMetrics = elasticsearchMetrics({ sampleRate: 1 });

        Object.prototype.pollutedMetric = 0;
        try {
            assert.equal(ghostMetrics.getSampleRate('pollutedMetric'), 1);
        } finally {
            delete Object.prototype.pollutedMetric;
        }
    });

    it('ships at the default rate without consulting the random source', async function () {
        const ghostMetrics = elasticsearchMetrics();
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        const random = sandbox.stub(Math, 'random').returns(0.999999);

        await ghostMetrics.metric('unsampled-metric', 101);

        assert.equal(index.calledOnce, true);
        assert.equal(random.called, false);
        // Unsampled documents keep their existing shape
        assert.equal('sampleRate' in index.firstCall.args[0], false);
    });

    it('drops metrics that fall outside the sample rate', async function () {
        const ghostMetrics = elasticsearchMetrics({ sampleRate: 0.1 });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0.5);

        const result = await ghostMetrics.metric('sampled-metric', 101);

        assert.equal(index.called, false);
        assert.equal(result, null);
    });

    it('ships metrics that fall inside the sample rate, tagged with the rate', async function () {
        const ghostMetrics = elasticsearchMetrics({ sampleRate: 0.1 });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0.05);

        await ghostMetrics.metric('sampled-metric', 101);

        assert.equal(index.calledOnce, true);
        assert.equal(index.firstCall.args[0].value, 101);
        assert.equal(index.firstCall.args[0].sampleRate, 0.1);
    });

    it('never ships at a sample rate of 0', async function () {
        const ghostMetrics = elasticsearchMetrics({ sampleRate: 0 });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0);

        await ghostMetrics.metric('disabled-metric', 101);

        assert.equal(index.called, false);
    });

    it('prefers a per-metric rate over the default rate', async function () {
        const ghostMetrics = elasticsearchMetrics({
            sampleRate: 1,
            sampleRates: { 'noisy-metric': 0.2 },
        });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0.5);

        await ghostMetrics.metric('noisy-metric', 101);
        assert.equal(index.called, false);

        await ghostMetrics.metric('quiet-metric', 101);
        assert.equal(index.calledOnce, true);
    });

    it('prefers a per-call rate over configured rates', async function () {
        const ghostMetrics = elasticsearchMetrics({
            sampleRate: 0,
            sampleRates: { 'noisy-metric': 0 },
        });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0.5);

        await ghostMetrics.metric('noisy-metric', 101, { sampleRate: 1 });

        assert.equal(index.calledOnce, true);
    });

    it('ignores an invalid per-call rate rather than throwing', async function () {
        const ghostMetrics = elasticsearchMetrics({ sampleRate: 0.1 });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0.05);

        // Falls back to the configured rate of 0.1, which 0.05 survives
        await ghostMetrics.metric('sampled-metric', 101, { sampleRate: 'half' });
        await ghostMetrics.metric('sampled-metric', 102, { sampleRate: 42 });

        assert.equal(index.calledTwice, true);
        assert.equal(index.firstCall.args[0].sampleRate, 0.1);
        assert.equal(index.secondCall.args[0].sampleRate, 0.1);
    });

    it('does not treat inherited object properties as sample rates', async function () {
        const ghostMetrics = elasticsearchMetrics({ sampleRate: 0 });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        sandbox.stub(Math, 'random').returns(0);

        await ghostMetrics.metric('constructor', 101);

        assert.equal(index.called, false);
    });

    it('throws for an invalid configured sample rate', function () {
        for (const sampleRate of ['half', 1.5, -0.1, NaN, {}]) {
            assert.throws(
                () => new GhostMetrics({ metrics: { sampleRate } }),
                /metrics\.sampleRate must be a number between 0 and 1/,
            );
        }
    });

    it('throws for an invalid per-metric sample rate', function () {
        assert.throws(
            () => new GhostMetrics({ metrics: { sampleRates: { 'noisy-metric': 2 } } }),
            /metrics\.sampleRates\.noisy-metric must be a number between 0 and 1/,
        );
    });

    it('reports the sample rate on stdout only when sampled', async function () {
        const write = sandbox.stub(PrettyStream.prototype, 'write');
        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['stdout'],
                sampleRates: { 'sampled-metric': 0.5 },
            },
        });

        sandbox.stub(Math, 'random').returns(0.1);

        await ghostMetrics.metric('unsampled-metric', 101);
        assert.equal(write.firstCall.args[0].msg, 'Metric unsampled-metric: 101');

        await ghostMetrics.metric('sampled-metric', 101);
        assert.equal(write.secondCall.args[0].msg, 'Metric sampled-metric: 101 (sample rate: 0.5)');
    });
});

describe('Batching', function () {
    afterEach(function () {
        sandbox.restore();
    });

    function batchedMetrics(batch, metricsOptions) {
        return new GhostMetrics({
            metrics: {
                transports: ['elasticsearch'],
                batch,
                ...metricsOptions,
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
            },
        });
    }

    it('is off by default', async function () {
        const ghostMetrics = new GhostMetrics({ metrics: {} });
        assert.equal(ghostMetrics.batch, null);
        assert.deepEqual(ghostMetrics.batches, []);
        assert.equal(new GhostMetrics().batch, null);
        assert.equal(new GhostMetrics({ metrics: null }).batch, null);

        // A no-op, so shutdown handlers can call it unconditionally
        await assert.doesNotReject(() => new GhostMetrics().flush());
    });

    it('fills in defaults when enabled with `true`', function () {
        assert.deepEqual(batchedMetrics(true).batch, {
            size: 100,
            maxWaitMs: 5000,
            maxBufferSize: 1000,
        });
    });

    it('accepts partial config, defaulting the buffer cap from the size', function () {
        assert.deepEqual(batchedMetrics({ size: 10 }).batch, {
            size: 10,
            maxWaitMs: 5000,
            maxBufferSize: 100,
        });
    });

    it('treats false and an `enabled: false` bag as off', function () {
        assert.equal(batchedMetrics(false).batch, null);
        assert.equal(batchedMetrics({ enabled: false, size: 10 }).batch, null);
    });

    it('throws for invalid batch config', function () {
        assert.throws(() => batchedMetrics('yes'), /metrics\.batch must be a boolean or an object/);
        assert.throws(() => batchedMetrics([1]), /metrics\.batch must be a boolean or an object/);
        assert.throws(
            () => batchedMetrics({ enabled: 'false' }),
            /metrics\.batch\.enabled must be a boolean/,
        );

        for (const size of ['10', 0, -1, 1.5, NaN]) {
            assert.throws(
                () => batchedMetrics({ size }),
                /metrics\.batch\.size must be a positive whole number/,
            );
        }

        assert.throws(
            () => batchedMetrics({ maxWaitMs: 0 }),
            /metrics\.batch\.maxWaitMs must be a positive whole number/,
        );
        assert.throws(
            () => batchedMetrics({ maxBufferSize: 0 }),
            /metrics\.batch\.maxBufferSize must be a positive whole number/,
        );
        assert.throws(
            () => batchedMetrics({ size: 10, maxBufferSize: 5 }),
            /metrics\.batch\.maxBufferSize must be at least metrics\.batch\.size \(10\), got 5/,
        );
    });

    it('buffers metrics and ships them in one bulk request', async function () {
        const ghostMetrics = batchedMetrics({ size: 3 }, { metadata: { id: '123123' } });
        const index = sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();

        await ghostMetrics.metric('cache-hit', 1);
        await ghostMetrics.metric('cache-miss', 2);

        // Nothing shipped yet, and never one request per metric
        assert.equal(bulk.called, false);
        assert.equal(index.called, false);

        await ghostMetrics.metric('cache-hit', 3);
        await ghostMetrics.flush();

        assert.equal(bulk.calledOnce, true);

        const operations = bulk.firstCall.args[0];
        assert.equal(operations.length, 3);
        assert.deepEqual(
            operations.map((operation) => operation.index),
            ['metrics-cache-hit', 'metrics-cache-miss', 'metrics-cache-hit'],
        );
        assert.deepEqual(
            operations.map((operation) => operation.document.value),
            [1, 2, 3],
        );
        assert.equal(operations[0].document.metadata.id, '123123');
        assert.notEqual(operations[0].document['@timestamp'], undefined);
    });

    it('ships a partial buffer on flush', async function () {
        const ghostMetrics = batchedMetrics({ size: 100 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();

        await ghostMetrics.metric('cache-hit', 1);
        await ghostMetrics.flush();

        assert.equal(bulk.calledOnce, true);
        assert.equal(bulk.firstCall.args[0].length, 1);

        // Nothing left to ship
        await ghostMetrics.flush();
        assert.equal(bulk.calledOnce, true);
    });

    it('ships the buffer once the max wait elapses', async function () {
        const clock = sandbox.useFakeTimers();
        const ghostMetrics = batchedMetrics({ size: 100, maxWaitMs: 1000 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();

        await ghostMetrics.metric('cache-hit', 1);
        assert.equal(bulk.called, false);

        await clock.tickAsync(999);
        assert.equal(bulk.called, false);

        await clock.tickAsync(1);
        assert.equal(bulk.calledOnce, true);
        assert.equal(bulk.firstCall.args[0].length, 1);

        // The timer isn't rearmed until the next metric arrives
        await clock.tickAsync(5000);
        assert.equal(bulk.calledOnce, true);

        await ghostMetrics.metric('cache-hit', 2);
        await clock.tickAsync(1000);
        assert.equal(bulk.calledTwice, true);
    });

    it('does not rearm the max wait timer for every metric', async function () {
        const clock = sandbox.useFakeTimers();
        const ghostMetrics = batchedMetrics({ size: 100, maxWaitMs: 1000 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();

        await ghostMetrics.metric('cache-hit', 1);
        await clock.tickAsync(900);
        await ghostMetrics.metric('cache-hit', 2);
        await clock.tickAsync(100);

        // The second metric didn't push the first one's deadline out
        assert.equal(bulk.calledOnce, true);
        assert.equal(bulk.firstCall.args[0].length, 2);
    });

    it('drops metrics once the buffer cap is reached', async function () {
        const ghostMetrics = batchedMetrics({ size: 2, maxBufferSize: 4 });
        // Never settles, so nothing can drain behind the first batch
        sandbox.stub(ElasticSearch.prototype, 'bulk').returns(new Promise(() => {}));

        for (let i = 0; i < 10; i += 1) {
            await ghostMetrics.metric('cache-hit', i);
        }

        const [batch] = ghostMetrics.batches;
        // Two metrics are in flight, four are buffered, the rest are shed
        assert.equal(batch.buffer.length, 4);
        assert.equal(batch.dropped, 4);
    });

    it('keeps only one bulk request in flight', async function () {
        const ghostMetrics = batchedMetrics({ size: 2 });
        let resolveFirst;
        const bulk = sandbox
            .stub(ElasticSearch.prototype, 'bulk')
            .onFirstCall()
            .returns(
                new Promise((resolve) => {
                    resolveFirst = resolve;
                }),
            )
            .onSecondCall()
            .resolves();

        await ghostMetrics.metric('cache-hit', 1);
        await ghostMetrics.metric('cache-hit', 2);
        assert.equal(bulk.calledOnce, true);

        await ghostMetrics.metric('cache-hit', 3);
        await ghostMetrics.metric('cache-hit', 4);

        // The second batch waits behind the first
        assert.equal(bulk.calledOnce, true);

        resolveFirst();
        await ghostMetrics.flush();

        assert.equal(bulk.calledTwice, true);
        assert.equal(bulk.secondCall.args[0].length, 2);
    });

    it('queues a full buffer while another bulk request is in flight', async function () {
        const clock = sandbox.useFakeTimers();
        const ghostMetrics = batchedMetrics({ size: 2, maxWaitMs: 1000 });
        let resolveFirst;
        const bulk = sandbox
            .stub(ElasticSearch.prototype, 'bulk')
            .onFirstCall()
            .returns(
                new Promise((resolve) => {
                    resolveFirst = resolve;
                }),
            )
            .onSecondCall()
            .resolves();

        await ghostMetrics.metric('cache-hit', 1);
        await ghostMetrics.metric('cache-hit', 2);
        await ghostMetrics.metric('cache-hit', 3);
        await ghostMetrics.metric('cache-hit', 4);

        assert.equal(bulk.calledOnce, true);

        resolveFirst();
        await ghostMetrics.flush();

        // The full second buffer is already queued; it does not wait for its timer.
        assert.equal(clock.now, 0);
        assert.equal(bulk.calledTwice, true);
        assert.equal(bulk.secondCall.args[0].length, 2);
    });

    it('keeps shipping after a failed batch', async function () {
        const ghostMetrics = batchedMetrics({ size: 1 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk');
        bulk.onFirstCall().rejects(new Error('boom'));
        bulk.onSecondCall().resolves();

        await assert.doesNotReject(() => ghostMetrics.metric('cache-hit', 1));
        await ghostMetrics.flush();

        await ghostMetrics.metric('cache-hit', 2);
        await ghostMetrics.flush();

        assert.equal(bulk.calledTwice, true);
    });

    it('drops batched metrics that fall outside the sample rate', async function () {
        const ghostMetrics = batchedMetrics({ size: 1 }, { sampleRate: 0.1 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();
        sandbox.stub(Math, 'random').returns(0.5);

        await ghostMetrics.metric('cache-hit', 1);
        await ghostMetrics.flush();

        assert.equal(bulk.called, false);
    });

    it('tags batched documents with the sample rate they survived', async function () {
        const ghostMetrics = batchedMetrics({ size: 1 }, { sampleRate: 0.5 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();
        sandbox.stub(Math, 'random').returns(0.1);

        await ghostMetrics.metric('cache-hit', 1);
        await ghostMetrics.flush();

        assert.equal(bulk.firstCall.args[0][0].document.sampleRate, 0.5);
    });

    it('copies object values so a buffered document cannot be mutated', async function () {
        const metadata = { site: { id: 'original' } };
        const ghostMetrics = batchedMetrics({ size: 100 }, { metadata });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();

        const value = { operation: 'get', result: { source: 'cache' } };
        await ghostMetrics.metric('cache-error', value);
        value.operation = 'set';
        value.result.source = 'database';
        metadata.site.id = 'changed';

        await ghostMetrics.flush();

        assert.equal(bulk.firstCall.args[0][0].document.operation, 'get');
        assert.equal(bulk.firstCall.args[0][0].document.result.source, 'cache');
        assert.equal(bulk.firstCall.args[0][0].document.metadata.site.id, 'original');
        // The caller's object is left alone
        assert.deepEqual(Object.keys(value), ['operation', 'result']);
    });

    it('honours a pre-set timestamp and shipping without metadata', async function () {
        const ghostMetrics = batchedMetrics({ size: 1 });
        ghostMetrics.metadata = null;
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();

        await ghostMetrics.metric('object-metric', { value: 101, '@timestamp': 12345 });
        await ghostMetrics.flush();

        assert.deepEqual(bulk.firstCall.args[0][0].document, { value: 101, '@timestamp': 12345 });
    });

    it('wraps non-object values, including null and arrays', async function () {
        const ghostMetrics = batchedMetrics({ size: 100 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();

        await ghostMetrics.metric('null-metric', null);
        await ghostMetrics.metric('array-metric', [1, 2]);
        await ghostMetrics.flush();

        const [nullOperation, arrayOperation] = bulk.firstCall.args[0];
        assert.equal(nullOperation.document.value, null);
        assert.deepEqual(arrayOperation.document.value, [1, 2]);
    });

    it('does not throw when a metric value cannot be deeply cloned', async function () {
        const ghostMetrics = batchedMetrics({ size: 1 });
        const bulk = sandbox.stub(ElasticSearch.prototype, 'bulk').resolves();
        const callback = () => 'not cloneable';
        const leaf = new WeakMap();
        const nullPrototype = Object.assign(Object.create(null), { state: 'before' });
        const value = {
            nested: { callback, state: 'before' },
            list: [{ state: 'before' }],
            nullPrototype,
            leaf,
        };
        value.self = value;

        await assert.doesNotReject(() => ghostMetrics.metric('callback-metric', value));
        value.nested.state = 'after';
        value.list[0].state = 'after';
        nullPrototype.state = 'after';
        await ghostMetrics.flush();

        const document = bulk.firstCall.args[0][0].document;
        assert.equal(document.nested.callback, callback);
        assert.equal(document.nested.state, 'before');
        assert.equal(document.list[0].state, 'before');
        assert.equal(document.nullPrototype.state, 'before');
        assert.equal(document.leaf, leaf);
        assert.equal(document.self, document);
    });

    it('leaves the stdout transport unbatched', async function () {
        const write = sandbox.stub(PrettyStream.prototype, 'write');
        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['stdout'],
                batch: { size: 100 },
            },
        });

        await ghostMetrics.metric('cache-hit', 1);

        assert.equal(write.calledOnce, true);
        assert.deepEqual(ghostMetrics.batches, []);
    });
});
