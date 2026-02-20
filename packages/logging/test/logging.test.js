const fs = require('fs');
const PrettyStream = require('@tryghost/pretty-stream');
const GhostLogger = require('../lib/GhostLogger');
const includes = require('lodash/includes');
const errors = require('@tryghost/errors');
const sinon = require('sinon');
const assert = require('assert/strict');
const Bunyan2Loggly = require('bunyan-loggly');
const GelfStream = require('gelf-stream').GelfStream;
const ElasticSearch = require('@tryghost/elasticsearch').BunyanStream;
const HttpStream = require('@tryghost/http-stream');
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

        assert.equal(ghostLogger.name, loggerName);

        fs.unlinkSync('loggingrc.js');
    });

    it('Works without loggingrc.js', function () {
        const ghostLogger = require('../index');
        assert.doesNotThrow(() => {
            ghostLogger.info('Checking logging works');
        });
    });
});

describe('Logging', function () {
    afterEach(function () {
        sandbox.restore();
    });

    it('throws for an invalid transport', function () {
        assert.throws(() => {
            new GhostLogger({transports: ['nope']});
        }, /Nope is an invalid transport/);
    });

    it('moves stdout to the first transport position', function () {
        const ghostLogger = new GhostLogger({
            transports: ['stderr', 'stdout']
        });

        assert.equal(ghostLogger.transports[0], 'stdout');
    });

    it('respects LOIN env override for level and mode', function () {
        process.env.LOIN = '1';
        try {
            const ghostLogger = new GhostLogger({transports: []});
            assert.equal(ghostLogger.level, 'info');
            assert.equal(ghostLogger.mode, 'long');
        } finally {
            delete process.env.LOIN;
        }
    });

    // in Bunyan 1.8.3 they have changed this behaviour
    // they are trying to find the err.message attribute and forward this as msg property
    // our PrettyStream implementation can't handle this case
    it('ensure stdout write properties', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.req, null);
            assert.notEqual(data.req.headers, null);
            assert.equal(data.req.body, undefined);
            assert.notEqual(data.res, null);
            assert.notEqual(data.err, null);
            assert.equal(data.name, 'testLogging');
            assert.equal(data.msg, 'message');
            done();
        });

        var ghostLogger = new GhostLogger({name: 'testLogging'});
        ghostLogger.info({err: new Error('message'), req: {body: {}, headers: {}}, res: {getHeaders: () => ({})}});
    });

    it('ensure stdout write properties with custom message', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data, null);
            assert.equal(data.name, 'Log');
            assert.equal(data.msg, 'A handled error! Original message');
            done();
        });

        var ghostLogger = new GhostLogger();
        ghostLogger.warn('A handled error!', new Error('Original message'));
    });

    it('ensure stdout write properties with object', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.err, null);
            assert.equal(data.test, 2);
            assert.equal(data.name, 'Log');
            assert.equal(data.msg, 'Got an error from 3rd party service X! Resource could not be found.');
            done();
        });

        var ghostLogger = new GhostLogger();
        ghostLogger.error({err: new errors.NotFoundError(), test: 2}, 'Got an error from 3rd party service X!');
    });

    it('ensure stdout write metadata properties', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            assert.equal(data.version, 2);
            assert.equal(data.msg, 'Message to be logged!');
            done();
        });

        var ghostLogger = new GhostLogger({metadata: {version: 2}});
        ghostLogger.info('Message to be logged!');
    });

    it('ensure stdout write properties with util.format', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data, null);
            assert.equal(data.name, 'Log');
            assert.equal(data.msg, 'Message with format');
            done();
        });

        var ghostLogger = new GhostLogger();
        var thing = 'format';
        ghostLogger.info('Message with %s', thing);
    });

    it('redact sensitive data with request body', function (done) {
        sandbox.stub(PrettyStream.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.req.body.password, null);
            assert.equal(data.req.body.password, '**REDACTED**');
            assert.notEqual(data.req.body.data.attributes.pin, null);
            assert.equal(data.req.body.data.attributes.pin, '**REDACTED**');
            assert.notEqual(data.req.body.data.attributes.test, null);
            assert.notEqual(data.err, null);
            assert.notEqual(data.err.errorDetails, null);
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
            assert.notEqual(data.err, null);
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
        assert.equal(GelfStream.prototype._write.called, true);
    });

    it('gelf uses default host and port when not provided', function () {
        const ghostLogger = new GhostLogger({
            transports: ['gelf'],
            gelf: {}
        });

        assert.notEqual(ghostLogger.streams.gelf, undefined);
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
        assert.equal(GelfStream.prototype._write.called, false);
    });

    it('loggly does only stream certain errors', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.err, null);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, true);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, false);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, false);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, false);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, true);
    });

    it('loggly does stream errors that match normal level', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.err, null);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, true);
    });

    it('loggly match can evaluate with null err payload', function () {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function () {});

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: '^null$'
            }
        });

        ghostLogger.error('plain error message');
        assert.equal(Bunyan2Loggly.prototype.write.called, true);
    });

    it('loggly does stream errors that match an one of multiple match statements', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.err, null);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, true);
    });

    it('loggly does stream errors that match status code: full example', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.err, null);
            assert.notEqual(data.req, null);
            assert.notEqual(data.res, null);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, true);
    });

    it('loggly does only stream certain errors: match is not defined -> log everything', function (done) {
        sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.err, null);
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
        assert.equal(Bunyan2Loggly.prototype.write.called, true);
    });

    it('elasticsearch should make a stream', function () {
        const es = new ElasticSearch({
            node: 'http://test-elastic-client',
            auth: {
                username: 'user',
                password: 'pass'
            }
        }, 'index', 'pipeline');

        const stream = es.getStream();
        assert.equal(typeof stream.write, 'function');
    });

    it('elasticsearch should receive a single object', async function () {
        sandbox.stub(ElasticSearch.prototype, 'getStream').returns({
            write: function (jsonData) {
                assert.equal(arguments.length, 1);
                const data = JSON.parse(jsonData);
                assert.equal(data.msg, 'hello 1');
                assert.equal(data.prop, 'prop val');
            }
        });

        var ghostLogger = new GhostLogger({
            transports: ['elasticsearch'],
            elasticsearch: {
                index: 'ghost-index',
                username: 'example',
                password: 'password',
                host: 'elastic-search-host'
            }
        });

        await ghostLogger.info({
            prop: 'prop val'
        }, 'hello', 1);
    });

    it('http writes a log message', function (done) {
        sandbox.stub(HttpStream.prototype, 'write').callsFake(function (data) {
            assert.notEqual(data.err, null);
            done();
        });

        var ghostLogger = new GhostLogger({
            transports: ['http'],
            http: {
                host: 'http://localhost'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        assert.equal(HttpStream.prototype.write.called, true);
    });

    it('http does not write an info log in error mode', function () {
        sandbox.spy(HttpStream.prototype, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['http'],
            http: {
                host: 'http://localhost',
                level: 'error'
            }
        });

        ghostLogger.info('testing');
        assert.equal(HttpStream.prototype.write.called, false);
    });

    it('http can write errors in info mode', function () {
        sandbox.spy(HttpStream.prototype, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['http'],
            http: {
                host: 'http://localhost',
                level: 'info'
            }
        });

        ghostLogger.error('testing');
        assert.equal(HttpStream.prototype.write.called, true);
    });

    it('automatically adds stdout to transports if stderr transport is configured and stdout isn\'t', function () {
        var ghostLogger = new GhostLogger({
            transports: ['stderr']
        });

        assert.equal(includes(ghostLogger.transports, 'stderr'), true, 'stderr transport should exist');
        assert.equal(includes(ghostLogger.transports, 'stdout'), true, 'stdout transport should exist');
    });

    it('logs errors only to stderr if both stdout and stderr transports are defined', function () {
        var stderr = sandbox.spy(process.stderr, 'write');
        var stdout = sandbox.spy(process.stdout, 'write');

        var ghostLogger = new GhostLogger({
            transports: ['stdout', 'stderr']
        });

        ghostLogger.error('some error');
        assert.equal(stderr.calledOnce, true);
        assert.equal(stdout.called, false, 'stdout should not be written to');
    });

    it('logs to parent port when in a worker thread', function (done) {
        const worker = new Worker('./test/fixtures/worker.js');
        worker.on('message', (data) => {
            assert.equal(data, 'Hello!');
            done();
        });
    });

    describe('filename computation', function () {
        it('sanitizeDomain should replace non-word characters with underscores', function () {
            var ghostLogger = new GhostLogger();
            assert.equal(ghostLogger.sanitizeDomain('http://my-domain.com'), 'http___my_domain_com');
            assert.equal(ghostLogger.sanitizeDomain('localhost'), 'localhost');
            assert.equal(ghostLogger.sanitizeDomain('example.com:8080'), 'example_com_8080');
        });

        it('replaceFilenamePlaceholders should replace {env} placeholder', function () {
            var ghostLogger = new GhostLogger({env: 'production'});
            assert.equal(ghostLogger.replaceFilenamePlaceholders('{env}'), 'production');
        });

        it('replaceFilenamePlaceholders should replace {domain} placeholder', function () {
            var ghostLogger = new GhostLogger({domain: 'http://example.com'});
            assert.equal(ghostLogger.replaceFilenamePlaceholders('{domain}'), 'http___example_com');
        });

        it('replaceFilenamePlaceholders should replace both {env} and {domain} placeholders', function () {
            var ghostLogger = new GhostLogger({
                domain: 'http://example.com',
                env: 'staging'
            });
            assert.equal(ghostLogger.replaceFilenamePlaceholders('{domain}-{env}'), 'http___example_com-staging');
            assert.equal(ghostLogger.replaceFilenamePlaceholders('{env}.{domain}'), 'staging.http___example_com');
        });

        it('logger should return default format when no filename option provided', function () {
            var ghostLogger = new GhostLogger({
                domain: 'http://example.com',
                env: 'production'
            });
            assert.equal(ghostLogger.filename, '{domain}_{env}');
        });

        it('logger should use filename template when provided', function () {
            var ghostLogger = new GhostLogger({
                domain: 'http://example.com',
                env: 'production',
                filename: '{env}'
            });
            assert.equal(ghostLogger.filename, '{env}');
        });

        it('file stream should use custom filename template', function () {
            const tempDir = './test-logs/';
            const rimraf = function (dir) {
                if (fs.existsSync(dir)) {
                    fs.readdirSync(dir).forEach(function (file) {
                        const curPath = dir + '/' + file;
                        if (fs.lstatSync(curPath).isDirectory()) {
                            rimraf(curPath);
                        } else {
                            fs.unlinkSync(curPath);
                        }
                    });
                    fs.rmdirSync(dir);
                }
            };

            // Create temp directory
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, {recursive: true});
            }

            var ghostLogger = new GhostLogger({
                domain: 'test.com',
                env: 'production',
                filename: '{env}',
                transports: ['file'],
                path: tempDir
            });

            ghostLogger.info('Test log message');

            // Give it a moment to write
            setTimeout(function () {
                assert.equal(fs.existsSync(tempDir + 'production.log'), true);
                assert.equal(fs.existsSync(tempDir + 'production.error.log'), true);

                // Cleanup
                rimraf(tempDir);
            }, 100);
        });

        it('file stream supports built-in rotating-file transport config', function () {
            const tempDir = './test-logs-rotation-built-in/';
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, {recursive: true});
            }

            const ghostLogger = new GhostLogger({
                domain: 'test.com',
                env: 'production',
                transports: ['file'],
                path: tempDir,
                rotation: {
                    enabled: true,
                    useLibrary: false,
                    period: '1d',
                    count: 2
                }
            });

            assert.notEqual(ghostLogger.streams['rotation-errors'], undefined);
            assert.notEqual(ghostLogger.streams['rotation-all'], undefined);
        });

        it('file stream supports external rotating file library config', function () {
            const tempDir = './test-logs-rotation-library/';
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, {recursive: true});
            }

            const ghostLogger = new GhostLogger({
                domain: 'test.com',
                env: 'production',
                transports: ['file'],
                path: tempDir,
                rotation: {
                    enabled: true,
                    useLibrary: true,
                    period: '1d',
                    threshold: '10m',
                    count: 2,
                    gzip: true,
                    rotateExisting: false
                }
            });

            assert.notEqual(ghostLogger.streams['rotation-errors'], undefined);
            assert.notEqual(ghostLogger.streams['rotation-all'], undefined);
        });

        it('file stream rotation library handles missing rotateExisting option', function () {
            const tempDir = './test-logs-rotation-library-default/';
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, {recursive: true});
            }

            const ghostLogger = new GhostLogger({
                domain: 'test.com',
                env: 'production',
                transports: ['file'],
                path: tempDir,
                rotation: {
                    enabled: true,
                    useLibrary: true,
                    period: '1d',
                    threshold: '10m',
                    count: 2,
                    gzip: true
                }
            });

            assert.notEqual(ghostLogger.streams['rotation-errors'], undefined);
            assert.notEqual(ghostLogger.streams['rotation-all'], undefined);
        });

        it('file stream exits early when target directory does not exist', function () {
            const badPath = './test-logs-missing-dir/';
            const ghostLogger = new GhostLogger({
                transports: ['file'],
                path: badPath
            });

            assert.equal(ghostLogger.streams['file-errors'], undefined);
            assert.equal(ghostLogger.streams['file-all'], undefined);
        });
    });

    describe('serialization', function () {
        it('serializes error into correct object', function (done) {
            const err = new errors.NotFoundError();

            sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
                assert.notEqual(data.err, null);
                assert.equal(data.err.id, err.id);
                assert.equal(data.err.domain, 'localhost');
                assert.equal(data.err.code, null);
                assert.equal(data.err.name, err.errorType);
                assert.equal(data.err.statusCode, err.statusCode);
                assert.equal(data.err.level, err.level);
                assert.equal(data.err.message, err.message);
                assert.equal(data.err.context, undefined);
                assert.equal(data.err.help, undefined);
                assert.notEqual(data.err.stack, null);
                assert.equal(data.err.hideStack, undefined);
                assert.equal(data.err.errorDetails, undefined);
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

            assert.equal(Bunyan2Loggly.prototype.write.called, true);
        });

        it('stringifies meta properties', function (done) {
            sandbox.stub(Bunyan2Loggly.prototype, 'write').callsFake(function (data) {
                assert.notEqual(data.err, null);
                assert.equal(data.err.context, '{"a":"b"}');
                assert.equal(data.err.errorDetails, '{"c":"d"}');
                assert.equal(data.err.help, '{"b":"a"}');
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

            assert.equal(Bunyan2Loggly.prototype.write.called, true);
        });

        it('serializes req extra and queueDepth fields when present', function () {
            const ghostLogger = new GhostLogger();
            const req = {
                requestId: 'req-1',
                userId: 'user-1',
                url: '/x',
                method: 'GET',
                originalUrl: '/x?y=1',
                params: {},
                headers: {},
                query: {},
                extra: {feature: 'on'},
                queueDepth: 7
            };

            const serialized = ghostLogger.serializers.req(req);
            assert.deepEqual(serialized.extra, {feature: 'on'});
            assert.equal(serialized.queueDepth, 7);
        });

        it('removeSensitiveData falls back to original value when recursive sanitization throws', function () {
            const ghostLogger = new GhostLogger();
            const nested = {};
            Object.defineProperty(nested, 'boom', {
                enumerable: true,
                get() {
                    throw new Error('boom');
                }
            });

            const data = ghostLogger.removeSensitiveData({nested});
            assert.equal(data.nested, nested);
        });
    });

    describe('logger internals', function () {
        it('adds local timestamp when useLocalTime is enabled', function () {
            const ghostLogger = new GhostLogger({
                transports: [],
                useLocalTime: true
            });
            const info = sinon.spy();

            ghostLogger.streams = {
                stdout: {
                    name: 'stdout',
                    log: {info}
                }
            };

            ghostLogger.log('info', ['hello']);

            assert.equal(info.calledOnce, true);
            assert.notEqual(info.args[0][0].time, undefined);
        });

        it('trace/debug/fatal delegate to log()', function () {
            const ghostLogger = new GhostLogger({transports: []});
            const logSpy = sinon.spy(ghostLogger, 'log');

            ghostLogger.trace('t');
            ghostLogger.debug('d');
            ghostLogger.fatal('f');

            assert.equal(logSpy.args[0][0], 'trace');
            assert.equal(logSpy.args[1][0], 'debug');
            assert.equal(logSpy.args[2][0], 'fatal');
        });

        it('child creates stream children with bound properties', function () {
            const ghostLogger = new GhostLogger({transports: []});
            const childA = sinon.stub().returns({id: 'a'});
            const childB = sinon.stub().returns({id: 'b'});

            ghostLogger.streams = {
                one: {
                    name: 'one',
                    log: {child: childA}
                },
                two: {
                    name: 'two',
                    log: {child: childB}
                }
            };

            const child = ghostLogger.child({requestId: 'abc'});

            assert.equal(childA.calledOnce, true);
            assert.equal(childB.calledOnce, true);
            assert.deepEqual(childA.args[0][0], {requestId: 'abc'});
            assert.deepEqual(childB.args[0][0], {requestId: 'abc'});
            assert.equal(child.streams.one.name, 'one');
            assert.equal(child.streams.two.name, 'two');
            assert.deepEqual(child.streams.one.log, {id: 'a'});
            assert.deepEqual(child.streams.two.log, {id: 'b'});
        });
    });
});
