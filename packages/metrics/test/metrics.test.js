const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const assert = require('assert/strict');
const ElasticSearch = require('@tryghost/elasticsearch');
const PrettyStream = require('@tryghost/pretty-stream');
const {getProcessRoot} = require('@tryghost/root-utils');
const GhostMetrics = require('../lib/GhostMetrics');
const sandbox = sinon.createSandbox();

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
                transports: [${transports.map(t => `'${t}'`).join(', ')}]
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

    it('stdout transport works', function (done) {
        const name = 'test-metric';
        const value = 101;

        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.msg, undefined);
            assert.equal(data.msg, `Metric ${name}: ${JSON.stringify(value)}`);
            done();
        });

        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['stdout']
            }
        });
        ghostMetrics.metric(name, value);
    });

    it('elasticsearch transport works', function (done) {
        const name = 'test-metric';
        const value = 101;

        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['elasticsearch'],
                metadata: {
                    id: '123123'
                }
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                level: 'info'
            }
        });

        sandbox.stub(ElasticSearch.prototype, 'index').callsFake(function (data, index) {
            assert.notEqual(data.metadata, undefined);
            assert.equal(data.metadata.id, ghostMetrics.metadata.id);
            assert.equal(data.value, value);

            // ElasticSearch shipper prefixes metric names to avoid polluting index namespace
            assert.equal(index, 'metrics-' + name);
            done();
        });

        ghostMetrics.metric(name, value);
    });

    it('throws for invalid transport', function () {
        assert.throws(() => {
            new GhostMetrics({
                metrics: {
                    transports: ['not-a-transport']
                }
            });
        });
    });

    it('defaults to short mode', function () {
        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['stdout']
            }
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

        const emptyMetricsConfig = new GhostMetrics({metrics: {}});
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
                    id: '123123'
                }
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                level: 'info'
            }
        });

        sandbox.stub(ElasticSearch.prototype, 'index').rejects();

        await assert.doesNotReject(() => ghostMetrics.metric(name, value));
    });

    it('passes configured proxy to elasticsearch', function () {
        const name = 'proxy-metric';
        const value = 2;

        const ghostMetrics = new GhostMetrics({
            metrics: {
                transports: ['elasticsearch']
            },
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                proxy: 'https://proxy.example.com'
            }
        });

        sandbox.stub(ElasticSearch.prototype, 'index').resolves();
        ghostMetrics.metric(name, value);
        assert.equal(ElasticSearch.prototype.index.calledOnce, true);
    });
});
