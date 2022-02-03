const assert = require('assert');
const {Request, RequestOptions} = require('./request');

class ExpectRequest extends Request {
    constructor(...args) {
        super(...args);
    }

    expectStatus(expected) {
        const assertion = {
            fn: '_assertStatus',
            expected
        };

        this._addAssertion(assertion);

        return this;
    }

    expectHeader(expectedField, expectedValue) {
        const assertion = {
            fn: '_assertHeader',
            expectedField: expectedField.toLowerCase(),
            expectedValue
        };

        this._addAssertion(assertion);

        return this;
    }
    finalize(callback) {
        super.finalize((error, response) => {
            if (this.assertions) {
                this._assertAll(response);
            }
            callback(error, response);
        });
    }

    _assertAll(result) {
        for (const assertion of this.assertions) {
            this[assertion.fn](result, assertion);
        }
    }

    _addAssertion(assertion) {
        let error = new assert.AssertionError({
            message: 'Unexpected result',
            expected: assertion.expected,
            stackStartFn: this._addAssertion
        });

        error.contextString = this.reqOptions.toString();
        assertion.error = error;

        this.assertions = this.assertions || [];
        this.assertions.push(assertion);
    }

    _assertStatus(result, assertion) {
        const {error} = assertion;

        error.message = `Expected statusCode ${assertion.expected}, got statusCode ${result.statusCode} ${error.contextString}`;
        error.actual = result.statusCode;

        assert.equal(result.statusCode, assertion.expected, error);
    }

    _assertHeader(result, assertion) {
        const {expectedField, expectedValue, error} = assertion;
        const actual = result.headers[expectedField];
        const expectedHeaderString = `${expectedField}: ${expectedValue}`;
        const actualHeaderString = `${expectedField}: ${actual}`;

        error.expected = expectedHeaderString;
        error.actual = actualHeaderString;

        error.message = `Expected header "${expectedHeaderString}" to exist but got ${JSON.stringify(result.headers)} ${error.contextString}`;
        assert.notStrictEqual(actual, undefined, error);

        error.message = `Expected header "${expectedHeaderString}", got ${actualHeaderString} ${error.contextString}`;
        assert.equal(expectedHeaderString, actualHeaderString, error);
    }
}

module.exports = ExpectRequest;
module.exports.ExpectRequest = ExpectRequest;
module.exports.RequestOptions = RequestOptions;
