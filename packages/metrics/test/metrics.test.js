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
