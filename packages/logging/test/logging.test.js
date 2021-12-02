const fs = require('fs');
const PrettyStream = require('@tryghost/pretty-stream');
const GhostLogger = require('../lib/GhostLogger');
const includes = require('lodash/includes');
const errors = require('@tryghost/errors');
const sinon = require('sinon');
const should = require('should');
const Bunyan2Loggly = require('bunyan-loggly');
const GelfStream = require('gelf-stream').GelfStream;
const ElasticSearch = require('@tryghost/elasticsearch').BunyanStream;
const sandbox = sinon.createSandbox();
const {Worker} = require('worker_threads');

describe('Logging config', function () {
    it('Reads file called loggingrc.js', function () {
        const loggerName = 'Logging test';
        const loggingRc = `module.exports = {
            name: "${loggerName}"
        };`;

        fs.writeFileSync('loggingrc.js', loggingRc);

        const ghostLogger = require('../index');

        ghostLogger.name.should.eql(loggerName);

        fs.unlinkSync('loggingrc.js');
    });

    it('Works without loggingrc.js', function () {
        const ghostLogger = require('../index');
        should.doesNotThrow(() => {
            ghostLogger.info('Checking logging works');
        });
    });
});

describe('Logging', function () {
    afterEach(function () {
        sandbox.restore();
    });

    // in Bunyan 1.8.3 they have changed this behaviour
    // they are trying to find the err.message attribute and forward this as msg property
    // our PrettyStream implementation can't handle this case
    it('ensure stdout write properties', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            should.exist(data.req);
            should.exist(data.req.headers);
            should.not.exist(data.req.body);
            should.exist(data.res);
            should.exist(data.err);
            data.name.should.eql('testLogging');
            data.msg.should.eql('message');
            done();
        });

        var ghostLogger = new GhostLogger({name: 'testLogging'});
        ghostLogger.info({err: new Error('message'), req: {body: {}, headers: {}}, res: {getHeaders: () => ({})}});
    });

    it('ensure stdout write properties with custom message', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            should.exist(data);
            data.name.should.eql('Log');
            data.msg.should.eql('A handled error! Original message');
            done();
        });

        var ghostLogger = new GhostLogger();
        ghostLogger.warn('A handled error!', new Error('Original message'));
    });

    it('ensure stdout write properties with object', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            should.exist(data.err);
            data.test.should.eql(2);
            data.name.should.eql('Log');
            data.msg.should.eql('Got an error from 3rd party service X! Resource could not be found.');
            done();
        });

        var ghostLogger = new GhostLogger();
        ghostLogger.error({err: new errors.NotFoundError(), test: 2}, 'Got an error from 3rd party service X!');
    });

    it('ensure stdout write properties with util.format', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            should.exist(data);
            data.name.should.eql('Log');
            data.msg.should.eql('Message with format');
            done();
        });

        var ghostLogger = new GhostLogger();
        var thing = 'format';
        ghostLogger.info('Message with %s', thing);
    });

    it('redact sensitive data with request body', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            should.exist(data.req.body.password);
            data.req.body.password.should.eql('**REDACTED**');
            should.exist(data.req.body.data.attributes.pin);
            data.req.body.data.attributes.pin.should.eql('**REDACTED**');
            should.exist(data.req.body.data.attributes.test);
            should.exist(data.err);
            should.exist(data.err.errorDetails);
            done();
        });

        var ghostLogger = new GhostLogger({logBody: true});

        ghostLogger.error({
            err: new errors.IncorrectUsageError({message: 'Hallo', errorDetails: []}),
            req: {
                body: {
                    password: '12345678',
                    data: {
                        attributes: {
                            pin: '1234',
                            test: 'ja'
                        }
                    }
                },
                headers: {
                    authorization: 'secret',
                    Connection: 'keep-alive'
                }
            },
            res: {getHeaders: () => ({})}
        });
    });

    it('gelf writes a log message', function (done) {
        sandbox.stub(GelfStream.prototype, '_write').callsFake(function (data) {
            should.exist(data.err);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['gelf'],
            gelf: {
                host: 'localhost',
                port: 12201
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        GelfStream.prototype._write.called.should.eql(true);
    });

    it('gelf does not write a log message', function () {
        sandbox.spy(GelfStream.prototype, '_write');

        var ghostLogger = new GhostLogger({
            transports: ['gelf'],
            level: 'warn',
            gelf: {
                host: 'localhost',
                port: 12201
            }
        });

        ghostLogger.info('testing');
        GelfStream.prototype._write.called.should.eql(false);
    });

    it('loggly does only stream certain errors', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            should.exist(data.err);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:critical'
            }
        });

        ghostLogger.error(new errors.InternalServerError());
        Bunyan2Loggly.prototype.write.called.should.eql(true);
    });

    it('loggly does not stream non-critical errors when matching critical', function () {
        sandbox.spy(Bunyan2Loggly.prototype, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:critical'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        Bunyan2Loggly.prototype.write.called.should.eql(false);
    });

    it('loggly does not stream errors that do not match regex', function () {
        sandbox.spy(Bunyan2Loggly.prototype, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: '^((?!statusCode:4\\d{2}).)*$'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        Bunyan2Loggly.prototype.write.called.should.eql(false);
    });

    it('loggly does not stream errors when not nested correctly', function () {
        sandbox.spy(Bunyan2Loggly.prototype, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: '^((?!statusCode:4\\d{2}).)*$'
            }
        });

        ghostLogger.error(new errors.NoPermissionError());
        Bunyan2Loggly.prototype.write.called.should.eql(false);
    });

    it('loggly does stream errors that match regex', function () {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function () {});

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: '^((?!statusCode:4\\d{2}).)*$'
            }
        });

        ghostLogger.error(new errors.InternalServerError());
        Bunyan2Loggly.prototype.write.called.should.eql(true);
    });

    it('loggly does stream errors that match normal level', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            should.exist(data.err);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:normal'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        Bunyan2Loggly.prototype.write.called.should.eql(true);
    });

    it('loggly does stream errors that match an one of multiple match statements', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            should.exist(data.err);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:critical|statusCode:404'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        Bunyan2Loggly.prototype.write.called.should.eql(true);
    });

    it('loggly does stream errors that match status code: full example', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            should.exist(data.err);
            should.exist(data.req);
            should.exist(data.res);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'statusCode:404'
            }
        });

        ghostLogger.error({
            err: new errors.NotFoundError(),
            req: {body: {password: '12345678', data: {attributes: {pin: '1234', test: 'ja'}}}},
            res: {getHeaders: () => ({})}
        });
        Bunyan2Loggly.prototype.write.called.should.eql(true);
    });

    it('loggly does only stream certain errors: match is not defined -> log everything', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            should.exist(data.err);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        Bunyan2Loggly.prototype.write.called.should.eql(true);
    });

    it('elasticsearch writes a log message', function (done) {
        sandbox.stub(ElasticSearch.prototype, 'write').callsFake(function (data) {
            should.exist(data.err);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['elasticsearch'],
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        ElasticSearch.prototype.write.called.should.eql(true);
    });

    it('elasticsearch does not write a log message', function () {
        sandbox.spy(ElasticSearch.prototype, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['elasticsearch'],
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                level: 'error'
            }
        });

        ghostLogger.info('testing');
        ElasticSearch.prototype.write.called.should.eql(false);
    });

    it('elasticsearch can write errors in info mode', function () {
        sandbox.spy(ElasticSearch.prototype, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['elasticsearch'],
            elasticsearch: {
                host: 'https://test-elasticsearch',
                username: 'user',
                password: 'pass',
                level: 'info'
            }
        });

        ghostLogger.error('testing');
        ElasticSearch.prototype.write.called.should.eql(true);
    });

    it('automatically adds stdout to transports if stderr transport is configured and stdout isn\'t', function () {
        var ghostLogger = new GhostLogger({
            transports: ['stderr']
        });

        should.equal(includes(ghostLogger.transports, 'stderr'), true, 'stderr transport should exist');
        should.equal(includes(ghostLogger.transports, 'stdout'), true, 'stdout transport should exist');
    });

    it('logs errors only to stderr if both stdout and stderr transports are defined', function () {
        var stderr = sandbox.spy(process.stderr, 'write');
        var stdout = sandbox.spy(process.stdout, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['stdout', 'stderr']
        });

        ghostLogger.error('some error');
        stderr.calledOnce.should.be.true();
        stdout.called.should.be.false('stdout should not be written to');
    });

    it('logs to parent port when in a worker thread', function (done) {
        const worker = new Worker('./test/fixtures/worker.js');
        worker.on('message', (data) => {
            data.should.eql('Hello!');
            done();
        });
    });

    describe('serialization', function () {
        it('serializes error into correct object', function (done) {
            const err = new errors.NotFoundError();

            sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
                should.exist(data.err);
                data.err.id.should.eql(err.id);
                data.err.domain.should.eql('localhost');
                should.equal(data.err.code, null);
                data.err.name.should.eql(err.errorType);
                should.equal(data.err.statusCode, err.statusCode);
                data.err.level.should.eql(err.level);
                data.err.message.should.eql(err.message);
                should.equal(data.err.context, undefined);
                should.equal(data.err.help, undefined);
                should.exist(data.err.stack);
                should.equal(data.err.hideStack, undefined);
                should.equal(data.err.errorDetails, undefined);
                done();
            });

            const ghostLogger = new GhostLogger({
                transports: ['loggly'],
                loggly: {
                    token: 'invalid',
                    subdomain: 'invalid'
                }
            });
            ghostLogger.error({
                err
            });

            Bunyan2Loggly.prototype.write.called.should.eql(true);
        });

        it('stringifies meta properties', function (done) {
            sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
                should.exist(data.err);
                data.err.context.should.eql('{"a":"b"}');
                data.err.errorDetails.should.eql('{"c":"d"}');
                data.err.help.should.eql('{"b":"a"}');
                done();
            });

            const ghostLogger = new GhostLogger({
                transports: ['loggly'],
                loggly: {
                    token: 'invalid',
                    subdomain: 'invalid'
                }
            });
            ghostLogger.error({
                err: new errors.NotFoundError({
                    context: {
                        a: 'b'
                    },
                    errorDetails: {
                        c: 'd'
                    },
                    help: {
                        b: 'a'
                    }
                })
            });

            Bunyan2Loggly.prototype.write.called.should.eql(true);
        });
    });
});