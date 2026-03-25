const assert = require('assert/strict');
const nock = require('nock');
const sinon = require('sinon');
const rewire = require('rewire');

const request = require('../lib/request');

describe('Request', function () {
    it('has "safe" version in default user-agent header', function () {
        const url = 'http://some-website.com/endpoint/';

        nock('http://some-website.com')
            .get('/endpoint/')
            .reply(200, 'Response body');

        return request(url, {}).then(function (res) {
            assert.match(res.request.options.headers['user-agent'], /Ghost\/[0-9]+\.[0-9]+\s/);
        });
    });

    it('can be called with no options', function () {
        const url = 'http://some-website.com/endpoint/';

        const requestMock = nock('http://some-website.com')
            .get('/endpoint/')
            .reply(200, 'Response body');

        return request(url).then(function () {
            assert.equal(requestMock.isDone(), true);
        });
    });

    it('[success] should return response for http request', function () {
        const url = 'http://some-website.com/endpoint/';
        const expectedResponse = {
            body: 'Response body',
            url: 'http://some-website.com/endpoint/',
            statusCode: 200
        };
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        const requestMock = nock('http://some-website.com')
            .get('/endpoint/')
            .reply(200, 'Response body');

        return request(url, options).then(function (res) {
            assert.equal(requestMock.isDone(), true);
            assert.notEqual(res, undefined);
            assert.notEqual(res.body, undefined);
            assert.equal(res.body, expectedResponse.body);
            assert.notEqual(res.url, undefined);
            assert.equal(res.statusCode, expectedResponse.statusCode);
            assert.notEqual(res.statusCode, undefined);
            assert.equal(res.url, expectedResponse.url);
        });
    });

    it('[success] can handle redirect', function () {
        const url = 'http://some-website.com/endpoint/';
        const expectedResponse = {
            body: 'Redirected response',
            url: 'http://someredirectedurl.com/files/',
            statusCode: 200
        };
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        const requestMock = nock('http://some-website.com')
            .get('/endpoint/')
            .reply(301, 'Oops, got redirected',
                {
                    location: 'http://someredirectedurl.com/files/'
                });

        const secondRequestMock = nock('http://someredirectedurl.com')
            .get('/files/')
            .reply(200, 'Redirected response');

        return request(url, options).then(function (res) {
            assert.equal(requestMock.isDone(), true);
            assert.equal(secondRequestMock.isDone(), true);
            assert.notEqual(res, undefined);
            assert.notEqual(res.body, undefined);
            assert.equal(res.body, expectedResponse.body);
            assert.notEqual(res.url, undefined);
            assert.equal(res.statusCode, expectedResponse.statusCode);
            assert.notEqual(res.statusCode, undefined);
            assert.equal(res.url, expectedResponse.url);
        });
    });

    it('[failure] can handle invalid url', function () {
        const url = 'test';
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        return request(url, options).then(() => {
            throw new Error('Request should have rejected with invalid url message');
        }, (err) => {
            assert.notEqual(err, undefined);
            assert.equal(err.message, 'URL empty or invalid.');
        });
    });

    it('[failure] can handle empty url', function () {
        const url = '';
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        return request(url, options).then(() => {
            throw new Error('Request should have rejected with invalid url message');
        }, (err) => {
            assert.notEqual(err, undefined);
            assert.equal(err.message, 'URL empty or invalid.');
        });
    });

    it('[failure] can handle an error with statuscode not 200', function () {
        const url = 'http://nofilehere.com/files/test.txt';
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        const requestMock = nock('http://nofilehere.com')
            .get('/files/test.txt')
            .reply(404);

        return request(url, options).then(() => {
            throw new Error('Request should have errored');
        }, (err) => {
            assert.equal(requestMock.isDone(), true);
            assert.notEqual(err, undefined);
            assert.equal(err.statusMessage, 'Not Found');
        });
    });

    it('[failure] returns error if request errors', function () {
        const url = 'http://nofilehere.com/files/test.txt';
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            retry: {
                // Set delay between retries to 1ms - 2 retries total
                limit: 2,
                backoffLimit: 1
            }
        };

        const requestMock = nock('http://nofilehere.com')
            .get('/files/test.txt')
            .times(3) // 1 original request + 2 default retries
            .reply(500, {message: 'something awful happened', code: 'AWFUL_ERROR'});

        return request(url, options).then(() => {
            throw new Error('Request should have errored with an awful error');
        }, (err) => {
            assert.equal(requestMock.isDone(), true);
            assert.notEqual(err, undefined);
            assert.equal(err.statusMessage, 'Internal Server Error');
            assert.match(err.body, /something awful happened/);
            assert.match(err.body, /AWFUL_ERROR/);
        });
    });

    it('[failure] should timeout when taking too long', function () {
        const url = 'http://some-website.com/endpoint/';
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: {
                request: 1
            },
            retry: {
                limit: 0
            } // got retries by default so we're disabling this behavior
        };

        nock('http://some-website.com')
            .get('/endpoint/')
            .delay(20)
            .reply(200, 'Response body');

        return request(url, options).then(() => {
            throw new Error('Should have timed out');
        }, (err) => {
            assert.equal(err.code, 'ETIMEDOUT');
        });
    });

    it('[success] defaults to POST when body is provided without method', function () {
        const url = 'http://some-website.com/post-endpoint/';
        const requestMock = nock('http://some-website.com')
            .post('/post-endpoint/', 'hello')
            .reply(200, 'ok');

        return request(url, {body: 'hello'}).then(function (res) {
            assert.equal(requestMock.isDone(), true);
            assert.equal(res.statusCode, 200);
        });
    });

    it('[success] defaults to POST when json is provided without method', function () {
        const url = 'http://some-website.com/json-endpoint/';
        const payload = {hello: 'world'};
        const requestMock = nock('http://some-website.com')
            .post('/json-endpoint/', payload)
            .reply(200, 'ok');

        return request(url, {json: payload}).then(function (res) {
            assert.equal(requestMock.isDone(), true);
            assert.equal(res.statusCode, 200);
        });
    });

    it('[success] keeps explicit method when body is provided (non-rewire path)', function () {
        const url = 'http://some-website.com/explicit-method-post-endpoint/';
        const requestMock = nock('http://some-website.com')
            .put('/explicit-method-post-endpoint/', 'hello')
            .reply(200, 'ok');

        return request(url, {
            method: 'PUT',
            body: 'hello',
            retry: {
                limit: 0
            }
        }).then(function (res) {
            assert.equal(requestMock.isDone(), true);
            assert.equal(res.statusCode, 200);
        });
    });

    it('[success] does not auto-set retry when NODE_ENV is unset', function () {
        const url = 'http://some-website.com/unset-env-endpoint/';
        const requestMock = nock('http://some-website.com')
            .get('/unset-env-endpoint/')
            .reply(200, 'ok');
        const originalNodeEnv = process.env.NODE_ENV;

        delete process.env.NODE_ENV;

        return request(url, {}).then((res) => {
            assert.equal(requestMock.isDone(), true);
            assert.equal(res.statusCode, 200);
        }).finally(() => {
            process.env.NODE_ENV = originalNodeEnv;
        });
    });

    it('[failure] adds request options and response fields onto thrown error', function () {
        const url = 'http://some-website.com/forbidden/';
        const requestMock = nock('http://some-website.com')
            .get('/forbidden/')
            .reply(403, 'forbidden');

        return request(url, {
            headers: {
                'x-test': 'yes'
            }
        }).then(() => {
            throw new Error('Should have failed');
        }, (err) => {
            assert.equal(requestMock.isDone(), true);
            assert.notEqual(err.method, undefined);
            assert.notEqual(err.url, undefined);
            assert.equal(err.statusCode, 403);
            assert.equal(err.body, 'forbidden');
            assert.notEqual(err.response, undefined);
        });
    });

    it('[failure] rethrows plain errors when response is missing', function () {
        const requestModule = rewire('../lib/request');
        const plainError = new Error('plain error');
        const gotStub = sinon.stub().rejects(plainError);

        requestModule.__set__('got', gotStub);
        requestModule.__get__('defaultOptions').dnsLookup = () => {};

        return requestModule('http://some-website.com/plain-error/', {retry: {limit: 0}}).then(() => {
            throw new Error('Should have failed');
        }, (err) => {
            assert.equal(gotStub.calledOnce, true);
            assert.equal(err, plainError);
        });
    });

    it('[success] does not force retry outside test environment', function () {
        const requestModule = rewire('../lib/request');
        const gotStub = sinon.stub().resolves({
            statusCode: 200,
            body: 'ok'
        });
        const originalNodeEnv = process.env.NODE_ENV;

        requestModule.__set__('got', gotStub);
        requestModule.__get__('defaultOptions').dnsLookup = () => {};

        process.env.NODE_ENV = 'production';

        return requestModule('http://some-website.com/no-test-retry/').then((res) => {
            assert.equal(res.statusCode, 200);
            assert.equal(gotStub.calledOnce, true);
            assert.equal(Object.prototype.hasOwnProperty.call(gotStub.firstCall.args[1], 'retry'), false);
        }).finally(() => {
            process.env.NODE_ENV = originalNodeEnv;
        });
    });

    it('[success] keeps explicit method when body is provided', function () {
        const requestModule = rewire('../lib/request');
        const gotStub = sinon.stub().resolves({
            statusCode: 200,
            body: 'ok'
        });

        requestModule.__set__('got', gotStub);
        requestModule.__get__('defaultOptions').dnsLookup = () => {};

        return requestModule('http://some-website.com/explicit-method-body/', {
            method: 'PUT',
            body: 'hello',
            retry: {
                limit: 0
            }
        }).then(() => {
            assert.equal(gotStub.calledOnce, true);
            assert.equal(gotStub.firstCall.args[1].method, 'PUT');
        });
    });

    it('[failure] hoists request options when response is missing', function () {
        const requestModule = rewire('../lib/request');
        const transportError = new Error('transport failure');

        transportError.options = {
            method: 'GET',
            url: 'http://some-website.com/transport-failure/'
        };

        const gotStub = sinon.stub().rejects(transportError);

        requestModule.__set__('got', gotStub);
        requestModule.__get__('defaultOptions').dnsLookup = () => {};

        return requestModule('http://some-website.com/transport-failure/', {
            retry: {
                limit: 0
            }
        }).then(() => {
            throw new Error('Should have failed');
        }, (err) => {
            assert.equal(gotStub.calledOnce, true);
            assert.equal(err.method, 'GET');
            assert.equal(err.url, 'http://some-website.com/transport-failure/');
            assert.equal(err.options, undefined);
            assert.equal(err.response, undefined);
        });
    });
});
