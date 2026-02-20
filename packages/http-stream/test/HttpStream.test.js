require('should');
const sinon = require('sinon');

const requestPath = require.resolve('@tryghost/request');
const originalRequest = require(requestPath);
const indexPath = require.resolve('../index');
const httpStreamPath = require.resolve('../lib/HttpStream');

let HttpStream;
let requestStub;

const testConfig = {
    url: 'http://127.0.0.1:3001'
};

describe('HttpStream', function () {
    describe('write', function () {
        beforeEach(function () {
            requestStub = sinon.stub();
            require.cache[requestPath].exports = requestStub;
            delete require.cache[indexPath];
            delete require.cache[httpStreamPath];
            HttpStream = require('../index');
        });

        afterEach(function () {
            sinon.restore();
            require.cache[requestPath].exports = originalRequest;
            delete require.cache[indexPath];
            delete require.cache[httpStreamPath];
        });

        it('return false when string passed', async function () {
            const stream = new HttpStream(testConfig);
            const res = await stream.write('this shouldnt work');
            res.should.eql(false);
            sinon.assert.notCalled(requestStub);
        });

        it('be successful when object passed', async function () {
            const expectedRes = {
                statusCode: 200,
                body: '{"this":"should work"}'
            };
            requestStub.resolves(expectedRes);

            const stream = new HttpStream(testConfig);
            const body = {this: 'should work'};
            const res = await stream.write(body);

            sinon.assert.calledOnceWithExactly(requestStub, testConfig.url, {
                method: 'POST',
                json: body
            });
            res.should.eql(expectedRes);
        });

        it('return false when request fails', async function () {
            requestStub.rejects(new Error('request failed'));

            const stream = new HttpStream(testConfig);
            const res = await stream.write({this: 'should fail'});

            res.should.eql(false);
        });
    });
});
