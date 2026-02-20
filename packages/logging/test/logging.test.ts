import fs from 'fs';
import PrettyStream from '@tryghost/pretty-stream';
import GhostLogger from '../src/GhostLogger';
import includes from 'lodash/includes';
import errors from '@tryghost/errors';
import sinon from 'sinon';
import should from 'should';
import Bunyan2Loggly from 'bunyan-loggly';
import {GelfStream} from 'gelf-stream';
import {BunyanStream as ElasticSearch} from '@tryghost/elasticsearch';
import HttpStream from '@tryghost/http-stream';
import {Worker} from 'worker_threads';

// Cast a sinon stub to a generic form to allow flexible callsFake signatures
const flexStub = (s: sinon.SinonStub) => s as sinon.SinonStub;

const sandbox = sinon.createSandbox();

describe('Logging', function () {
    describe('Logging config', function () {
        it('Reads file called loggingrc.js', function () {
            const loggerName = 'Logging test';
            const loggingRc = `module.exports = {
                name: "${loggerName}"
            };`;

            fs.writeFileSync('loggingrc.js', loggingRc);

            const ghostLogger = require('../src/index'); // eslint-disable-line @typescript-eslint/no-require-imports

            ghostLogger.name.should.eql(loggerName);

            fs.unlinkSync('loggingrc.js');
        });

        it('Works without loggingrc.js', function () {
            const ghostLogger = require('../src/index'); // eslint-disable-line @typescript-eslint/no-require-imports
            should.doesNotThrow(() => {
                ghostLogger.info('Checking logging works');
            });
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    // in Bunyan 1.8.3 they have changed this behaviour
    // they are trying to find the err.message attribute and forward this as msg property
    // our PrettyStream implementation can't handle this case
    it('ensure stdout write properties', function (done) {
        flexStub(sandbox.stub(PrettyStream.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.req);
            should.exist((d.req as Record<string, unknown>).headers);
            should.not.exist((d.req as Record<string, unknown>).body);
            should.exist(d.res);
            should.exist(d.err);
            (d.name as string).should.eql('testLogging');
            (d.msg as string).should.eql('message');
            done();
        });

        const ghostLogger = new GhostLogger({name: 'testLogging'});
        ghostLogger.info({err: new Error('message'), req: {body: {}, headers: {}}, res: {getHeaders: () => ({})}});
    });

    it('ensure stdout write properties with custom message', function (done) {
        flexStub(sandbox.stub(PrettyStream.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d);
            (d.name as string).should.eql('Log');
            (d.msg as string).should.eql('A handled error! Original message');
            done();
        });

        const ghostLogger = new GhostLogger();
        ghostLogger.warn('A handled error!', new Error('Original message'));
    });

    it('ensure stdout write properties with object', function (done) {
        flexStub(sandbox.stub(PrettyStream.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            (d.test as number).should.eql(2);
            (d.name as string).should.eql('Log');
            (d.msg as string).should.eql('Got an error from 3rd party service X! Resource could not be found.');
            done();
        });

        const ghostLogger = new GhostLogger();
        ghostLogger.error({err: new errors.NotFoundError(), test: 2}, 'Got an error from 3rd party service X!');
    });

    it('ensure stdout write metadata properties', function (done) {
        flexStub(sandbox.stub(PrettyStream.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            (d.version as number).should.eql(2);
            (d.msg as string).should.eql('Message to be logged!');
            done();
        });

        const ghostLogger = new GhostLogger({metadata: {version: 2}});
        ghostLogger.info('Message to be logged!');
    });

    it('ensure stdout write properties with util.format', function (done) {
        flexStub(sandbox.stub(PrettyStream.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d);
            (d.name as string).should.eql('Log');
            (d.msg as string).should.eql('Message with format');
            done();
        });

        const ghostLogger = new GhostLogger();
        const thing = 'format';
        ghostLogger.info('Message with %s', thing);
    });

    it('redact sensitive data with request body', function (done) {
        flexStub(sandbox.stub(PrettyStream.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            const req = d.req as Record<string, unknown>;
            const body = req.body as Record<string, unknown>;
            should.exist(body.password);
            (body.password as string).should.eql('**REDACTED**');
            const dataAttrs = (body.data as Record<string, unknown>).attributes as Record<string, unknown>;
            should.exist(dataAttrs.pin);
            (dataAttrs.pin as string).should.eql('**REDACTED**');
            should.exist(dataAttrs.test);
            should.exist(d.err);
            should.exist((d.err as Record<string, unknown>).errorDetails);
            done();
        });

        const ghostLogger = new GhostLogger({logBody: true});

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
        flexStub(sandbox.stub(GelfStream.prototype, '_write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            done();
        });

        const ghostLogger = new GhostLogger({
            transports: ['gelf'],
            gelf: {
                host: 'localhost',
                port: 12201
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        (GelfStream.prototype._write as sinon.SinonStub).called.should.eql(true);
    });

    it('gelf does not write a log message', function () {
        sandbox.spy(GelfStream.prototype, '_write');

        const ghostLogger = new GhostLogger({
            transports: ['gelf'],
            level: 'warn',
            gelf: {
                host: 'localhost',
                port: 12201
            }
        });

        ghostLogger.info('testing');
        (GelfStream.prototype._write as sinon.SinonSpy).called.should.eql(false);
    });

    it('loggly does only stream certain errors', function (done) {
        flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            done();
        });

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:critical'
            }
        });

        ghostLogger.error(new errors.InternalServerError());
        (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
    });

    it('loggly does not stream non-critical errors when matching critical', function () {
        sandbox.spy(Bunyan2Loggly.prototype, 'write');

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:critical'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        (Bunyan2Loggly.prototype.write as sinon.SinonSpy).called.should.eql(false);
    });

    it('loggly does not stream errors that do not match regex', function () {
        sandbox.spy(Bunyan2Loggly.prototype, 'write');

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: '^((?!statusCode:4\\d{2}).)*$'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        (Bunyan2Loggly.prototype.write as sinon.SinonSpy).called.should.eql(false);
    });

    it('loggly does not stream errors when not nested correctly', function () {
        sandbox.spy(Bunyan2Loggly.prototype, 'write');

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: '^((?!statusCode:4\\d{2}).)*$'
            }
        });

        ghostLogger.error(new errors.NoPermissionError());
        (Bunyan2Loggly.prototype.write as sinon.SinonSpy).called.should.eql(false);
    });

    it('loggly does stream errors that match regex', function () {
        flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function () {});

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: '^((?!statusCode:4\\d{2}).)*$'
            }
        });

        ghostLogger.error(new errors.InternalServerError());
        (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
    });

    it('loggly does stream errors that match normal level', function (done) {
        flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            done();
        });

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:normal'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
    });

    it('loggly does stream errors that match an one of multiple match statements', function (done) {
        flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            done();
        });

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid',
                match: 'level:critical|statusCode:404'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
    });

    it('loggly does stream errors that match status code: full example', function (done) {
        flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            should.exist(d.req);
            should.exist(d.res);
            done();
        });

        const ghostLogger = new GhostLogger({
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
        (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
    });

    it('loggly does only stream certain errors: match is not defined -> log everything', function (done) {
        flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            done();
        });

        const ghostLogger = new GhostLogger({
            transports: ['loggly'],
            loggly: {
                token: 'invalid',
                subdomain: 'invalid'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
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
        (stream.write as unknown as ((...args: unknown[]) => void)).should.instanceOf(Function);
    });

    it('elasticsearch should receive a single object', async function () {
        sandbox.stub(ElasticSearch.prototype, 'getStream').returns({
            write: function (...writeArgs: unknown[]) {
                writeArgs.length.should.eql(1);
                const data = JSON.parse(writeArgs[0] as string);
                (data.msg as string).should.eql('hello 1');
                (data.prop as string).should.eql('prop val');
            }
        });

        const ghostLogger = new GhostLogger({
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
        flexStub(sandbox.stub(HttpStream.prototype, 'write')).callsFake(function (data: unknown) {
            const d = data as Record<string, unknown>;
            should.exist(d.err);
            done();
        });

        const ghostLogger = new GhostLogger({
            transports: ['http'],
            http: {
                url: 'http://localhost'
            }
        });

        ghostLogger.error(new errors.NotFoundError());
        (HttpStream.prototype.write as sinon.SinonStub).called.should.eql(true);
    });

    it('http does not write an info log in error mode', function () {
        sandbox.spy(HttpStream.prototype, 'write');

        const ghostLogger = new GhostLogger({
            transports: ['http'],
            http: {
                url: 'http://localhost',
                level: 'error'
            }
        });

        ghostLogger.info('testing');
        (HttpStream.prototype.write as sinon.SinonSpy).called.should.eql(false);
    });

    it('http can write errors in info mode', function () {
        sandbox.spy(HttpStream.prototype, 'write');

        const ghostLogger = new GhostLogger({
            transports: ['http'],
            http: {
                url: 'http://localhost',
                level: 'info'
            }
        });

        ghostLogger.error('testing');
        (HttpStream.prototype.write as sinon.SinonSpy).called.should.eql(true);
    });

    it('automatically adds stdout to transports if stderr transport is configured and stdout isn\'t', function () {
        const ghostLogger = new GhostLogger({
            transports: ['stderr']
        });

        should.equal(includes(ghostLogger.transports, 'stderr'), true, 'stderr transport should exist');
        should.equal(includes(ghostLogger.transports, 'stdout'), true, 'stdout transport should exist');
    });

    it('logs errors only to stderr if both stdout and stderr transports are defined', function () {
        const stderr = sandbox.spy(process.stderr, 'write');
        const stdout = sandbox.spy(process.stdout, 'write');

        const ghostLogger = new GhostLogger({
            transports: ['stdout', 'stderr']
        });

        ghostLogger.error('some error');
        stderr.calledOnce.should.be.true();
        stdout.called.should.be.false('stdout should not be written to');
    });

    it('logs to parent port when in a worker thread', function (done) {
        const worker = new Worker('./test/fixtures/worker.js');
        worker.on('message', (data: string) => {
            data.should.eql('Hello!');
            done();
        });
    });

    describe('filename computation', function () {
        it('sanitizeDomain should replace non-word characters with underscores', function () {
            const ghostLogger = new GhostLogger();
            ghostLogger.sanitizeDomain('http://my-domain.com').should.eql('http___my_domain_com');
            ghostLogger.sanitizeDomain('localhost').should.eql('localhost');
            ghostLogger.sanitizeDomain('example.com:8080').should.eql('example_com_8080');
        });

        it('replaceFilenamePlaceholders should replace {env} placeholder', function () {
            const ghostLogger = new GhostLogger({env: 'production'});
            ghostLogger.replaceFilenamePlaceholders('{env}').should.eql('production');
        });

        it('replaceFilenamePlaceholders should replace {domain} placeholder', function () {
            const ghostLogger = new GhostLogger({domain: 'http://example.com'});
            ghostLogger.replaceFilenamePlaceholders('{domain}').should.eql('http___example_com');
        });

        it('replaceFilenamePlaceholders should replace both {env} and {domain} placeholders', function () {
            const ghostLogger = new GhostLogger({
                domain: 'http://example.com',
                env: 'staging'
            });
            ghostLogger.replaceFilenamePlaceholders('{domain}-{env}').should.eql('http___example_com-staging');
            ghostLogger.replaceFilenamePlaceholders('{env}.{domain}').should.eql('staging.http___example_com');
        });

        it('logger should return default format when no filename option provided', function () {
            const ghostLogger = new GhostLogger({
                domain: 'http://example.com',
                env: 'production'
            });
            ghostLogger.filename.should.eql('{domain}_{env}');
        });

        it('logger should use filename template when provided', function () {
            const ghostLogger = new GhostLogger({
                domain: 'http://example.com',
                env: 'production',
                filename: '{env}'
            });
            ghostLogger.filename.should.eql('{env}');
        });

        it('file stream should use custom filename template', function () {
            const tempDir = './test-logs/';
            const rimraf = function (dir: string) {
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

            const ghostLogger = new GhostLogger({
                domain: 'test.com',
                env: 'production',
                filename: '{env}',
                transports: ['file'],
                path: tempDir
            });

            ghostLogger.info('Test log message');

            // Give it a moment to write
            setTimeout(function () {
                fs.existsSync(tempDir + 'production.log').should.eql(true);
                fs.existsSync(tempDir + 'production.error.log').should.eql(true);

                // Cleanup
                rimraf(tempDir);
            }, 100);
        });
    });

    describe('serialization', function () {
        it('serializes error into correct object', function (done) {
            const err = new errors.NotFoundError();

            flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function (data: unknown) {
                const d = data as Record<string, unknown>;
                const errData = d.err as Record<string, unknown>;
                should.exist(errData);
                (errData.id as string).should.eql(err.id);
                (errData.domain as string).should.eql('localhost');
                should.equal(errData.code, null);
                (errData.name as string).should.eql(err.errorType);
                should.equal(errData.statusCode, err.statusCode);
                (errData.level as string).should.eql(err.level);
                (errData.message as string).should.eql(err.message);
                should.equal(errData.context, undefined);
                should.equal(errData.help, undefined);
                should.exist(errData.stack);
                should.equal(errData.hideStack, undefined);
                should.equal(errData.errorDetails, undefined);
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

            (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
        });

        it('stringifies meta properties', function (done) {
            flexStub(sandbox.stub(Bunyan2Loggly.prototype, 'write')).callsFake(function (data: unknown) {
                const d = data as Record<string, unknown>;
                const errData = d.err as Record<string, unknown>;
                should.exist(errData);
                (errData.context as string).should.eql('{"a":"b"}');
                (errData.errorDetails as string).should.eql('{"c":"d"}');
                (errData.help as string).should.eql('{"b":"a"}');
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
                    context: {a: 'b'} as unknown as string,
                    errorDetails: {c: 'd'},
                    help: {b: 'a'} as unknown as string
                })
            });

            (Bunyan2Loggly.prototype.write as sinon.SinonStub).called.should.eql(true);
        });
    });
});
