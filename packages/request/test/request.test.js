// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');
const should = require('should');
const nock = require('nock');

const request = require('../lib/request');

describe('Request', function () {
    it('has "safe" version in default user-agent header', function () {
        const url = 'http://some-website.com/endpoint/';

        nock('http://some-website.com')
            .get('/endpoint/')
            .reply(200, 'Response body');

        return request(url, {}).then(function ({req}) {
            req.headers['user-agent'].should.match(/Ghost\/[0-9]+\.[0-9]+\s/);
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
            requestMock.isDone().should.be.true();
            should.exist(res);
            should.exist(res.body);
            res.body.should.be.equal(expectedResponse.body);
            should.exist(res.url);
            res.statusCode.should.be.equal(expectedResponse.statusCode);
            should.exist(res.statusCode);
            res.url.should.be.equal(expectedResponse.url);
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
            requestMock.isDone().should.be.true();
            secondRequestMock.isDone().should.be.true();
            should.exist(res);
            should.exist(res.body);
            res.body.should.be.equal(expectedResponse.body);
            should.exist(res.url);
            res.statusCode.should.be.equal(expectedResponse.statusCode);
            should.exist(res.statusCode);
            res.url.should.be.equal(expectedResponse.url);
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
            should.exist(err);
            err.message.should.be.equal('URL empty or invalid.');
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
            should.exist(err);
            err.message.should.be.equal('URL empty or invalid.');
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
            requestMock.isDone().should.be.true();
            should.exist(err);
            err.statusMessage.should.be.equal('Not Found');
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
            requestMock.isDone().should.be.true();
            should.exist(err);
            err.statusMessage.should.be.equal('Internal Server Error');
            err.body.should.match(/something awful happened/);
            err.body.should.match(/AWFUL_ERROR/);
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
            err.code.should.be.equal('ETIMEDOUT');
        });
    });
});

