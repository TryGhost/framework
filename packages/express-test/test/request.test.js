const {assert} = require('./utils');
const Request = require('../lib/request');

describe('Request', function () {
    describe('Class functions', function () {
        it('constructor sets app and reqOptions', function () {
            const fn = () => {};
            const opts = {};
            const request = new Request(fn, opts);

            assert.equal(fn, request.app);
            assert.equal(opts, request.reqOptions);
        });

        it('_getReqRes generates req and res correctly', function () {
            const fn = () => {};
            const opts = {};
            const request = new Request(fn, opts);

            const {req, res} = request._getReqRes();
            assert.deepEqual(req.app, fn);
            assert.deepEqual(res.app, fn);
            assert.deepEqual(res.req, req);
        });

        it('_buildResponse handles buffer as body', function () {
            const fn = () => {};
            const opts = {};
            const request = new Request(fn, opts);

            const response = request._buildResponse(
                {
                    statusCode: 999,
                    body: Buffer.from('Hello World'),
                    getHeaders: () => {}
                }
            );
            assert.equal(response.statusCode, 999);
            assert.equal(response.text, 'Hello World');
        });

        it('_doRequest', async function (done) {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const opts = {};
            const request = new Request(fn, opts);

            request._doRequest((error, response) => {
                assert.equal(error, null);
                assert.equal(response.statusCode, 200);
                done();
            });
        });

        it('class is thenable', async function () {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const opts = {};
            const request = new Request(fn, opts);

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
            const opts = {};
            const request = new Request(fn, opts);

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

            const opts = {};
            const request = new Request(fn, opts);

            try {
                const response = await request;
                assert.equal(response.statusCode, 200); // this is the default
                assert.equal(response.text, 'Hello World!');
            } catch (error) {
                assert.fail(`This should not have thrown an error. Original error: ${error.stack}.`);
            }
        });

        it('converts body to text correctly for json', async function () {
            const fn = (req, res) => {
                res.json({hello: 'world'});
                res.emit('finish');
            };
            // Used by express internally to get etag function in .send()
            fn.get = () => { };

            const opts = {};
            const request = new Request(fn, opts);

            try {
                const response = await request;
                assert.equal(response.statusCode, 200); // this is the default
                assert.equal(response.text, '{"hello":"world"}');
            } catch (error) {
                assert.fail(`This should not have thrown an error. Original error: ${error.stack}.`);
            }
        });
    });
});
