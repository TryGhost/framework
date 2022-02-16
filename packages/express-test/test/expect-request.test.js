const {assert, sinon, stubCookies} = require('./utils');

const {ExpectRequest, RequestOptions} = require('../lib/expect-request');
const {snapshotManager} = require('@tryghost/jest-snapshot');
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

        it('finalize errors correctly when super.finalize is erroring', async function (done) {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            request.assertions = [];

            stubCookies(request);

            const theError = new Error();

            try {
                const superStub = sinon.stub(Request.prototype, 'finalize').callsArgWith(0, theError);
                const assertSpy = sinon.stub(request, '_assertAll');

                request.finalize((error) => {
                    sinon.assert.calledOnce(superStub);
                    assert.equal(error, theError);
                    sinon.assert.notCalled(assertSpy);
                    done();
                });
            } catch (error) {
                done(error);
            }
        });

        it('finalize errors correctly when assertions are erroring', async function (done) {
            const fn = (req, res) => {
                // This is how reqresnext works
                res.emit('finish');
            };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            request.assertions = [];

            stubCookies(request);

            const theError = new Error();

            try {
                const superStub = sinon.stub(Request.prototype, 'finalize').callsArg(0);
                const assertSpy = sinon.stub(request, '_assertAll').throws(theError);

                request.finalize((error) => {
                    sinon.assert.calledOnce(superStub);
                    sinon.assert.calledOnce(assertSpy);
                    assert.equal(error, theError);
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
            assert.equal(added.error.message, 'Unexpected assertion error');
            assert.equal(added.error.contextString, 'GET request on /');
        });

        it('_assertAll calls assertion functions for each assertion', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const fakeAssertion = sinon.stub();

            request.assertions = [
                {
                    fn: fakeAssertion
                },
                {
                    fn: fakeAssertion
                }
            ];

            const response = {foo: 'bar'};

            request._assertAll(response);

            sinon.assert.calledTwice(fakeAssertion);
            sinon.assert.calledWith(fakeAssertion, response);
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

        it('_assertStatus not ok when status i not ok and shows response error when present', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {
                statusCode: 404,
                body: {
                    errors: [{
                        message: 'Not found'
                    }]
                }
            };
            const assertion = {expected: 200, error};

            const assertFn = () => {
                request._assertStatus(response, assertion);
            };

            assert.throws(assertFn, {message: 'Expected statusCode 200, got statusCode 404 foo\nNot found'});
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

            assert.throws(assertFn, {message: 'Expected header "foo: bar", got "foo: baz" foo'});
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

            assert.throws(assertFn, {message: 'Expected header "foo: bar" to exist, got headers: {} foo'});
        });

        it('_assertHeader ok with matching regex for value', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {headers: {foo: 'baz'}};
            const assertion = {expectedField: 'foo', expectedValue: /^ba/, error};

            const assertFn = () => {
                request._assertHeader(response, assertion);
            };

            assert.doesNotThrow(assertFn);
        });

        it('_assertHeader mot ok with non-matching regex for value', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {headers: {foo: 'baz'}};
            const assertion = {expectedField: 'foo', expectedValue: /^bar/, error};

            const assertFn = () => {
                request._assertHeader(response, assertion);
            };

            assert.throws(assertFn, {message: 'Expected header "foo" to have value matching "/^bar/", got "baz" foo'});
        });

        it('_assertSnapshot ok when match is a pass', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {body: {foo: 'bar'}};
            const assertion = {properties: {}, field: 'body', error};

            const matchStub = sinon.stub(snapshotManager, 'match').returns({pass: true});

            const assertFn = () => {
                request._assertSnapshot(response, assertion);
            };

            assert.doesNotThrow(assertFn);

            // Assert side effects, check that hinting works as expected
            sinon.assert.calledOnce(matchStub);
            sinon.assert.calledOnceWithExactly(matchStub, response.body, {}, '[body]');
        });

        it('_assertSnapshot not ok when match is not a pass', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const error = new assert.AssertionError({});
            error.contextString = 'foo';

            const response = {body: {foo: 'bar'}};
            const assertion = {properties: {}, field: 'body', error};

            sinon.stub(snapshotManager, 'match').returns({pass: false});

            const assertFn = () => {
                request._assertSnapshot(response, assertion);
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
            sinon.assert.calledOnceWithExactly(addSpy, {
                fn: request._assertStatus,
                expected: 200,
                type: 'status'
            });
        });

        it('expectHeader calls _addAssertion [public interface]', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const addSpy = sinon.stub(request, '_addAssertion');

            request.expectHeader('foo', 'bar');

            sinon.assert.calledOnce(addSpy);
            sinon.assert.calledOnceWithExactly(addSpy, {
                fn: request._assertHeader,
                expectedField: 'foo',
                expectedValue: 'bar',
                type: 'header'
            });
        });

        it('matchBodySnapshot calls _addAssertion [public interface]', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const addSpy = sinon.stub(request, '_addAssertion');

            request.matchBodySnapshot({});

            sinon.assert.calledOnce(addSpy);
            sinon.assert.calledOnceWithExactly(addSpy, {fn: request._assertSnapshot, properties: {}, field: 'body'});
        });

        it('matchHeaderSnapshot calls _addAssertion [public interface]', function () {
            const fn = () => { };
            const jar = {};
            const opts = new RequestOptions();
            const request = new ExpectRequest(fn, jar, opts);

            const addSpy = sinon.stub(request, '_addAssertion');

            request.matchHeaderSnapshot({});

            sinon.assert.calledOnce(addSpy);
            sinon.assert.calledOnceWithExactly(addSpy, {
                fn: request._assertSnapshot,
                properties: {},
                field: 'headers',
                type: 'header'
            });
        });
    });
});
