const sinon = require('sinon');
const should = require('should');
const sandbox = sinon.createSandbox();

const logging = require('@tryghost/logging');
const EventEmitter = require('events');
const http = require('http');

// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

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
                    should.equal(port, testPort);
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
                    should.equal(port, testPipe);
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
                    should.equal(port, false);
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
            message.should.startWith(`Listening on pipe ${testAddress}`);
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

        sandbox.stub(logging, 'error').callsFake(function (message) { 
            message.should.startWith(`Port ${testPort} requires elevated privileges`);
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

        sandbox.stub(logging, 'error').callsFake(function (message) { 
            message.should.startWith(`Port ${testPort} is already in use`);
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

        should.doesNotThrow(server.stop);
    });
});
