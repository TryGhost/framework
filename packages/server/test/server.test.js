const sinon = require('sinon');
const assert = require('assert/strict');
const sandbox = sinon.createSandbox();

const logging = require('@tryghost/logging');
const EventEmitter = require('events');
const http = require('http');
const process = require('process');

const server = require('../lib/server');

describe('Server Utils', function () {
    // TODO: Mock http.createServer(app) to return { listen: (port) => {} } with logic for tests in there
    // TODO: Add setTimeout(() => {this.emit('error', err)}, 0) to server mock to test error handling

    afterEach(function () {
        sandbox.restore();
    });
    
    it('Normalises port number correctly', function (done) {
        const testPort = 180;

        sandbox.stub(http, 'createServer').callsFake(function () {
            return {
                listen: function (port) {
                    assert.equal(port, testPort);
                    done();
                }
            };
        });

        server.start({
            set: () => {}
        }, testPort.toString());
    });

    it('Normalises named pipe correctly', function (done) {
        const testPipe = 'hello';

        sandbox.stub(http, 'createServer').callsFake(function () {
            return {
                listen: function (port) {
                    assert.equal(port, testPipe);
                    done();
                }
            };
        });

        server.start({
            set: () => {}
        }, testPipe);
    });
    
    it('Normalises negative port value correctly', function (done) {
        const testPort = -80;

        sandbox.stub(http, 'createServer').callsFake(function () {
            return {
                listen: function (port) {
                    assert.equal(port, false);
                    done();
                }
            };
        });

        server.start({
            set: () => {}
        }, testPort.toString());
    });

    it('Emits listening event', function (done) {
        const testAddress = 'hello';

        sandbox.stub(logging, 'info').callsFake(function (message) { 
            assert.equal(message.startsWith(`Listening on pipe ${testAddress}`), true);
            done();
        });

        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                constructor() {
                    super();
                }
                listen() {
                    setTimeout(() => {
                        this.emit('listening');
                    }, 0);
                }
                address() {
                    return testAddress;
                }
            }

            return new Server();
        });

        server.start({
            set: () => {}
        }, 180);
    });

    it('Emits nice error for EACCES', function (done) {
        const testPort = 180;

        sandbox.stub(process, 'exit').callsFake(function () {
        });

        sandbox.stub(logging, 'error').callsFake(function (message) { 
            assert.equal(message.startsWith(`Port ${testPort} requires elevated privileges`), true);
            done();
        });

        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                constructor() {
                    super();
                }
                listen() {
                    setTimeout(() => {
                        this.emit('error', {
                            code: 'EACCES',
                            syscall: 'listen'
                        });
                    }, 0);
                }
            }

            return new Server();
        });

        server.start({
            set: () => {}
        }, testPort);
    });
    
    it('Emits nice error for EADDRINUSE', function (done) {
        const testPort = 180;

        sandbox.stub(process, 'exit').callsFake(function () {
        });

        sandbox.stub(logging, 'error').callsFake(function (message) { 
            assert.equal(message.startsWith(`Port ${testPort} is already in use`), true);
            done();
        });

        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                constructor() {
                    super();
                }
                listen() {
                    setTimeout(() => {
                        this.emit('error', {
                            code: 'EADDRINUSE',
                            syscall: 'listen'
                        });
                    }, 0);
                }
            }

            return new Server();
        });

        server.start({
            set: () => {}
        }, testPort);
    });

    it('Emits pipe-specific error message when bound to a named pipe', function (done) {
        const testPipe = 'server-pipe';

        sandbox.stub(process, 'exit').callsFake(function () {});
        sandbox.stub(logging, 'error').callsFake(function (message) {
            assert.equal(message.startsWith(`Pipe ${testPipe} requires elevated privileges`), true);
            done();
        });

        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                listen() {
                    setTimeout(() => {
                        this.emit('error', {
                            code: 'EACCES',
                            syscall: 'listen'
                        });
                    }, 0);
                }
            }

            return new Server();
        });

        server.start({
            set: () => {}
        }, testPipe);
    });

    it('Stops server without throwing', function () {
        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                constructor() {
                    super();
                }
                listen() {
                }
                close() {
                    throw new Error();
                }
            }
            return new Server();
        });

        server.start({
            set: () => {}
        }, 180);

        assert.doesNotThrow(server.stop);
    });

    it('Emits listening event with numeric port', function (done) {
        const testPort = 191;

        sandbox.stub(logging, 'info').callsFake(function (message) {
            assert.equal(message.startsWith(`Listening on port ${testPort}`), true);
            done();
        });

        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                listen() {
                    setTimeout(() => {
                        this.emit('listening');
                    }, 0);
                }
                address() {
                    return {port: testPort};
                }
            }

            return new Server();
        });

        server.start({
            set: () => {}
        }, testPort);
    });

    it('Throws unknown listen errors', function (done) {
        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                listen() {
                    setTimeout(() => {
                        assert.throws(() => {
                            this.emit('error', {
                                code: 'EOTHER',
                                syscall: 'listen'
                            });
                        });
                        done();
                    }, 0);
                }
            }

            return new Server();
        });

        server.start({
            set: () => {}
        }, 180);
    });

    it('Throws errors not originating from listen syscall', function (done) {
        sandbox.stub(http, 'createServer').callsFake(function () {
            class Server extends EventEmitter {
                listen() {
                    setTimeout(() => {
                        assert.throws(() => {
                            this.emit('error', {
                                code: 'EACCES',
                                syscall: 'not-listen'
                            });
                        });
                        done();
                    }, 0);
                }
            }

            return new Server();
        });

        server.start({
            set: () => {}
        }, 180);
    });
});
