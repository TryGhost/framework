// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');
const fs = require('fs');
const sinon = require('sinon');
const should = require('should');
const ElasticSearch = require('@tryghost/elasticsearch');
const PrettyStream = require('@tryghost/pretty-stream');
const GhostMetrics = require('../lib/GhostMetrics');
const sandbox = sinon.createSandbox();

describe('Metrics config', function () {
    it('Reads file called loggingrc.js', function () {
        const transports = ['stdout'];
        const loggingRc = `module.exports = {
            metrics: {
                transports: [${transports.map(t => `'${t}'`).join(', ')}]
            }
        };`;

        fs.writeFileSync('loggingrc.js', loggingRc);

        const ghostMetrics = require('../index');
        ghostMetrics.transports.should.eql(transports);

        fs.unlinkSync('loggingrc.js');
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
            should.exist(data.msg);
            data.msg.should.eql(`Metric ${name}: ${JSON.stringify(value)}`);
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
            should.exist(data.metadata);
            should.equal(data.metadata.id, ghostMetrics.metadata.id);
            should.equal(data.value, value);

            // ElasticSearch shipper prefixes metric names to avoid polluting index namespace
            should.equal(index, 'metrics-' + name);
            done();
        });

        ghostMetrics.metric(name, value);
    });

    it('throws for invalid transport', function () {
        should.throws(() => {
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

        ghostMetrics.mode.should.eql('short');
    });

    it('uses long mode when LOIN variable set', function () {
        process.env.LOIN = 'set';
        const ghostMetrics = new GhostMetrics({});

        ghostMetrics.mode.should.eql('long');
    });
});