const {assert, sinon, stubCookies} = require('./utils');
const {Request, RequestOptions} = require('../lib/Request');
const FormData = require('form-data');
const Stream = require('stream');

const streamToBuffer = async function (stream) {
    return new Promise((resolve, reject) => {
        const data = [];
        const onData = (chunk) => {
            data.push(chunk);
        };

        stream.pause(); // just to test the pause method

        stream.on('data', onData);

        stream.on('end', () => {
            stream.removeListener('data', onData); // to test the removeListener method
            resolve(Buffer.concat(data));
        });

        stream.on('error', (err) => {
            reject(err);
        });

        stream.read(); // just to test the read method
    });
};

/**
 * We need this to test the pipe method
 */
const createAwaitableStream = function () {
    const ws = new Stream();
    ws.writable = true;
    ws.data = [];
    ws.promise = new Promise((resolve) => {
        if (!ws.writable) {
            resolve(Buffer.concat(ws.data));
            return;
        }
        ws.resolve = resolve;
    });

    ws.write = function (buf) {
        ws.data.push(buf);
    };

    ws.end = function (buf) {
        if (arguments.length) {
            ws.write(buf);
        }
        ws.writable = false;

        if (ws.resolve) {
            ws.resolve(Buffer.concat(ws.data));
        }
    };

    ws.then = function (resolve, reject) {
        return ws.promise.then(resolve, reject);
    };

    return ws;
};

describe('Request', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('Class functions', function () {
        it('constructor sets app, jar and reqOptions when reqOptions is empty', function () {
            const fn = () => { };
            const jar = {};
            const opts = {};
            const request = new Request(fn, jar, opts);

            assert.equal(request.app, fn);
            assert.equal(request.cookieJar, jar);
            assert.notEqual(request.reqOptions, opts);
            assert.equal(request.reqOptions instanceof RequestOptions, true);
            assert.equal(request.reqOptions.method, 'GET');
            assert.equal(request.reqOptions.url, '/');
            assert.deepEqual(request.reqOptions.headers, {});
        });

        it('constructor sets app, jar and reqOptions', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            assert.equal(request.app, fn);
            assert.equal(request.cookieJar, jar);
            assert.equal(request.reqOptions, opts);
        });

        it('_getReqRes generates req and res correctly', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const {req, res} = request._getReqRes();
            assert.deepEqual(req.app, fn);
            assert.deepEqual(res.app, fn);
            assert.deepEqual(res.req, req);
        });

        it('_buildResponse handles string buffer as body', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const response = request._buildResponse(
                {
                    statusCode: 999,
                    body: Buffer.from('Hello World'),
                    getHeaders: () => { },
                    getHeader: () => {
                        return 'text/html';
                    }

                }
            );
            assert.equal(response.statusCode, 999);
            assert.equal(response.text, 'Hello World');
        });

        it('_buildResponse handles JSON buffer as body', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const response = request._buildResponse(
                {
                    statusCode: 111,
                    body: Buffer.from('{"hello":"world"}'),
                    getHeaders: () => { },
                    getHeader: () => {
                        return 'application/json';
                    }

                }
            );
            assert.equal(response.statusCode, 111);
            assert.equal(response.text, '{"hello":"world"}');
        });

        it('_getCookies', function () {
            const fn = () => { };
            const getCookies = {
                toValueString: sinon.stub()
            };
            const jar = {
                getCookies: sinon.stub().returns(getCookies)
            };
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const req = {url: '/'};

            request._getCookies(req);

            sinon.assert.calledOnce(jar.getCookies);
            sinon.assert.calledOnceWithMatch(jar.getCookies, sinon.match({path: '/'}));
            sinon.assert.calledOnce(getCookies.toValueString);
        });

        it('_restoreCookies does nothing with no cookies', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            request._getCookies = sinon.stub();

            const req = {headers: {}};
            request._restoreCookies(req);

            assert.equal(req.headers.cookie, undefined);
        });

        it('_restoreCookies restores cookes when present', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            request._getCookies = sinon.stub().returns('abc');

            const req = {headers: {}};
            request._restoreCookies(req);

            assert.equal(req.headers.cookie, 'abc');
        });

        it('_saveCookies does nothing with no cookies', function () {
            const fn = () => { };
            const jar = {
                setCookies: sinon.stub()
            };
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const res = {
                getHeader: sinon.stub()
            };

            request._saveCookies(res);

            sinon.assert.calledOnce(res.getHeader);
            sinon.assert.notCalled(jar.setCookies);
        });

        it('_saveCookies sets cookies on the cookiejar', function () {
            const fn = () => { };
            const jar = {
                setCookies: sinon.stub()
            };
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const res = {
                getHeader: sinon.stub().returns('xyz')
            };

            request._saveCookies(res);

            sinon.assert.calledOnce(res.getHeader);
            sinon.assert.calledOnce(jar.setCookies);
            sinon.assert.calledOnceWithMatch(jar.setCookies, 'xyz');
        });

        it('_doRequest', async function (done) {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            // Stub cookies, we'll test this behaviour later
            const {saveCookiesStub, restoreCookiesStub} = stubCookies(request);

            request._doRequest((error, response) => {
                assert.equal(error, null);
                assert.equal(response.statusCode, 200);

                sinon.assert.calledOnce(saveCookiesStub);
                sinon.assert.calledOnce(restoreCookiesStub);

                done();
            });
        });

        it('body() sets body correctly', function () {
            const fn = () => {};
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const body = {foo: 'bar'};

            request.body(body);

            assert.equal(request.reqOptions.body, body);
        });

        it('body() sets body correctly with FormData', async function () {
            const fn = () => {};
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const formData = new FormData();
            formData.append('foo', 'bar');

            request.body(formData);

            assert.equal(request.reqOptions.body, undefined);
            const {req} = request._getReqRes();
            const requestBody = (await streamToBuffer(req)).toString('utf8');
            assert.match(requestBody, /Content-Disposition: form-data; name="foo"\r\n\r\nbar/);
            assert.equal(req.headers['content-length'], requestBody.length);
            assert.equal(req.headers['content-type'], 'multipart/form-data; boundary=' + formData.getBoundary());
        });

        it('body() sets body correctly with string', async function () {
            const fn = () => {};
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const stringData = 'hello-world';
            request.body(stringData);

            assert.equal(request.reqOptions.body, undefined);
            const {req} = request._getReqRes();
            const requestBody = (await streamToBuffer(req)).toString('utf8');
            assert.equal(requestBody, stringData);
            assert.equal(req.headers['content-length'], stringData.length);
        });

        it('body() stream can pipe to writeable stream', async function () {
            const fn = () => {};
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const stringData = 'hello-world';
            request.body(stringData);

            assert.equal(request.reqOptions.body, undefined);
            const {req} = request._getReqRes();

            const writeableStream = createAwaitableStream();
            req.pipe(writeableStream);

            const requestBody = (await writeableStream).toString('utf8');
            assert.equal(requestBody, stringData);
            assert.equal(req.headers['content-length'], stringData.length);

            req.unpipe(writeableStream);
        });

        it('header() sets body correctly', function () {
            const fn = () => {};
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            request.header('foo', 'bar');

            assert.equal(request.reqOptions.headers.foo, 'bar');
        });

        it('attach() sets body correctly with single file', async function () {
            const fn = () => {};
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const path = require('path');
            const filePath = path.join(__dirname, 'fixtures/ghost-favicon.png');

            request.attach('image', filePath);

            assert.equal(request._formData instanceof FormData, true);
            assert.equal(request.reqOptions.body, undefined);

            // Verify the FormData contains the file
            const buffer = request._formData.getBuffer();
            const content = buffer.toString();
            assert.match(content, /Content-Disposition: form-data; name="image"/);
            assert.match(content, /filename="ghost-favicon.png"/);
        });

        it('attach() sets body correctly with multiple files', async function () {
            const fn = () => {};
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            const path = require('path');
            const fs = require('fs');
            const imagePath = path.join(__dirname, 'fixtures/ghost-favicon.png');
            const textPath = path.join(__dirname, 'fixtures/test-multi.txt');

            // Create a test text file
            fs.writeFileSync(textPath, 'test content');

            try {
                request
                    .attach('image', imagePath)
                    .attach('document', textPath);

                assert.equal(request._formData instanceof FormData, true);

                // Verify the FormData contains both files
                const buffer = request._formData.getBuffer();
                const content = buffer.toString();
                assert.match(content, /Content-Disposition: form-data; name="image"/);
                assert.match(content, /filename="ghost-favicon.png"/);
                assert.match(content, /Content-Disposition: form-data; name="document"/);
                assert.match(content, /filename="test-multi.txt"/);
            } finally {
                // Clean up
                fs.unlinkSync(textPath);
            }
        });

        it('class is thenable [public api]', async function () {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            // Stub getCookies, we'll test this behaviour later
            stubCookies(request);

            try {
                const response = await request;
                assert.equal(response.statusCode, 200); // this is the default
            } catch (error) {
                assert.fail(`This should not have thrown an error. Original error: ${error.message}.`);
            }
        });

        it('express errors are handled correctly', async function () {
            const fn = () => {
                throw new Error('something went wrong');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            // Stub getCookies, we'll test this behaviour later
            stubCookies(request);

            try {
                await request;
                assert.fail('Should have errored');
            } catch (error) {
                assert.equal(error.message, 'something went wrong');
            }
        });
    });

    describe('Testing with Express Internals', function () {
        it('converts body to text correctly for string', async function () {
            const fn = (req, res) => {
                // This is how express works
                res.send('Hello World!');
                res.emit('finish');
            };
            // Used by express internally to get etag function in .send()
            fn.get = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            stubCookies(request);

            let response;

            try {
                response = await request;
            } catch (error) {
                assert.fail(`This should not have thrown an error. Original error: ${error.stack}.`);
            }

            assert.equal(response.statusCode, 200); // this is the default
            assert.equal(response.text, 'Hello World!');
        });

        it('converts body to text correctly for json', async function () {
            const fn = (req, res) => {
                res.json({hello: 'world'});
                res.emit('finish');
            };
            // Used by express internally to get etag function in .send()
            fn.get = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new Request(fn, jar, opts);

            stubCookies(request);

            let response;
            try {
                response = await request;
            } catch (error) {
                assert.fail(`This should not have thrown an error. Original error: ${error.stack}.`);
            }

            assert.equal(response.statusCode, 200); // this is the default
            assert.equal(response.text, '{"hello":"world"}');
            assert.deepEqual(response.body, {hello: 'world'});
        });
    });
});
