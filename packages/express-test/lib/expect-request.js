const assert = require('assert');
const {Request, RequestOptions} = require('./request');

class ExpectRequest extends Request {
    constructor(...args) {
        super(...args);
    }

    expect(callback) {
        const wrapperFn = (response, assertion) => {
            try {
                callback(response);
            } catch (error) {
                error.stack = assertion.error.stack.replace(assertion.error.message, error.message);
                throw error;
            }
        };

        const assertion = {
            fn: wrapperFn
        };

        this._addAssertion(assertion);

        return this;
    }

    expectStatus(expected) {
        const assertion = {
            fn: this._assertStatus,
            expected
        };

        this._addAssertion(assertion);

        return this;
    }

    expectHeader(expectedField, expectedValue) {
        const assertion = {
            fn: this._assertHeader,
            expectedField: expectedField.toLowerCase(),
            expectedValue
        };

        this._addAssertion(assertion);

        return this;
    }
    finalize(callback) {
        super.finalize((error, response) => {
            if (error) {
                return callback(error);
            }

            try {
                if (this.assertions) {
                    this._assertAll(response);
                }
                return callback(null, response);
            } catch (_error) {
                return callback(_error);
            }
        });
    }

    _assertAll(response) {
        for (const assertion of this.assertions) {
            assertion.fn(response, assertion);
        }
    }

    _addAssertion(assertion) {
        let error = new assert.AssertionError({
            message: 'Unexpected assertion error',
            expected: assertion.expected,
            stackStartFn: this._addAssertion
        });

        error.contextString = this.reqOptions.toString();
        assertion.error = error;

        this.assertions = this.assertions || [];
        this.assertions.push(assertion);
    }

    _assertStatus(response, assertion) {
        const {error} = assertion;

        error.message = `Expected statusCode ${assertion.expected}, got statusCode ${response.statusCode} ${error.contextString}`;
        error.actual = response.statusCode;

        assert.equal(response.statusCode, assertion.expected, error);
    }

    _assertHeader(response, assertion) {
        const {expectedField, expectedValue, error} = assertion;
        const actual = response.headers[expectedField];
        const expectedHeaderString = `${expectedField}: ${expectedValue}`;
        const actualHeaderString = `${expectedField}: ${actual}`;

        error.expected = expectedHeaderString;
        error.actual = actualHeaderString;

        error.message = `Expected header "${expectedHeaderString}" to exist but got ${JSON.stringify(response.headers)} ${error.contextString}`;
        assert.notStrictEqual(actual, undefined, error);

        error.message = `Expected header "${expectedHeaderString}", got ${actualHeaderString} ${error.contextString}`;
        assert.equal(expectedHeaderString, actualHeaderString, error);
    }
}

module.exports = ExpectRequest;
module.exports.ExpectRequest = ExpectRequest;
module.exports.RequestOptions = RequestOptions;
