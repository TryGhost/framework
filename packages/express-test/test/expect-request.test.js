const {assert, sinon, stubCookies} = require('./utils');

const {ExpectRequest, RequestOptions} = require('../lib/expect-request');
const Request = require('../lib/request');

describe('ExpectRequest', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('Class functions', function () {
        it('constructor sets app, jar and reqOptions', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            assert.equal(request.app, fn);
            assert.equal(request.cookieJar, jar);
            assert.equal(request.reqOptions, opts);
        });

        it('class is thenable [public api]', async function () {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            // Stub getCookies, we'll test this behaviour later
            stubCookies(request);

            try {
                const response = await request;
                assert.equal(response.statusCode, 200); // this is the default
            } catch (error) {
                assert.fail(`This should not have thrown an error. Original error: ${error.message}.`);
            }
        });

        it('finalize with no assertions doesnt try to run assertions', async function (done) {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            stubCookies(request);

            try {
                const superStub = sinon.stub(Request.prototype, 'finalize').callsArg(0);
                const assertSpy = sinon.stub(request, '_assertAll');

                // I couldn't figure out how to stub the super.finalize call here
                request.finalize((error) => {
                    if (error) {
                        done(error);
                    }

                    sinon.assert.calledOnce(superStub);
                    assert.equal(error, null);
                    sinon.assert.notCalled(assertSpy);
                    done();
                });
            } catch (error) {
                done(error);
            }
        });

        it('finalize with assertions runs assertions', async function (done) {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            request.assertions = [];

            stubCookies(request);

            try {
                const superStub = sinon.stub(Request.prototype, 'finalize').callsArg(0);
                const assertSpy = sinon.stub(request, '_assertAll');

                // I couldn't figure out how to stub the super.finalize call here
                request.finalize((error) => {
                    if (error) {
                        done(error);
                    }

                    sinon.assert.calledOnce(superStub);
                    assert.equal(error, null);
                    sinon.assert.calledOnce(assertSpy);
                    done();
                });
            } catch (error) {
                done(error);
            }
        });

        it('_addAssertion adds an assertion', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const assertion = {};

            assert.equal(request.assertions, undefined);
            request._addAssertion(assertion);

            const added = request.assertions[0];
            assert.notEqual(request.assertions, undefined);
            assert.equal(added.error.message, 'Unexpected result');
            assert.equal(added.error.contextString, 'GET request on /');
        });

        it('_assertAll calls assertion functions for each assertion', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            request._fakeAssertion = sinon.stub();

            request.assertions = [
                {
                    fn: '_fakeAssertion'
                },
                {
                    fn: '_fakeAssertion'
                }
            ];

            const response = {foo: 'bar'};

            request._assertAll(response);

            sinon.assert.calledTwice(request._fakeAssertion);
            sinon.assert.calledWith(request._fakeAssertion, response);
        });

        it('_assertStatus ok when status is ok', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {statusCode: 200};
            const assertion = {expected: 200, error};

            const assertFn = () => {
                request._assertStatus(response, assertion);
            };

            assert.doesNotThrow(assertFn);
        });

        it('_assertStatus not ok when status is not ok', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {statusCode: 404};
            const assertion = {expected: 200, error};

            const assertFn = () => {
                request._assertStatus(response, assertion);
            };

            assert.throws(assertFn);
        });

        it('_assertHeader ok when header is ok', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {headers: {foo: 'bar'}};
            const assertion = {expectedField: 'foo', expectedValue: 'bar', error};

            const assertFn = () => {
                request._assertHeader(response, assertion);
            };

            assert.doesNotThrow(assertFn);
        });

        it('_assertHeader not ok when header is not ok', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {headers: {foo: 'baz'}};
            const assertion = {expectedField: 'foo', expectedValue: 'bar', error};

            const assertFn = () => {
                request._assertHeader(response, assertion);
            };

            assert.throws(assertFn);
        });

        it('_assertHeader not ok when status is not set', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {headers: {}};
            const assertion = {expectedField: 'foo', expectedValue: 'bar', error};

            const assertFn = () => {
                request._assertHeader(response, assertion);
            };

            assert.throws(assertFn);
        });

        it('expectStatus calls _addAssertion [public interface]', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const addSpy = sinon.stub(request, '_addAssertion');

            request.expectStatus(200);

            sinon.assert.calledOnce(addSpy);
            sinon.assert.calledOnceWithExactly(addSpy, {fn: '_assertStatus', expected: 200});
        });

        it('expectHeader calls _addAssertion [public interface]', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const addSpy = sinon.stub(request, '_addAssertion');

            request.expectHeader('foo', 'bar');

            sinon.assert.calledOnce(addSpy);
            sinon.assert.calledOnceWithExactly(addSpy, {fn: '_assertHeader', expectedField: 'foo', expectedValue: 'bar'});
        });
    });
});
