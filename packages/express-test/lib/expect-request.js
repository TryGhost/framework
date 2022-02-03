const assert = require('assert');
const {Request, RequestOptions} = require('./request');

class ExpectRequest extends Request {
    constructor(...args) {
        super(...args);
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
}

module.exports = ExpectRequest;
module.exports.ExpectRequest = ExpectRequest;
module.exports.RequestOptions = RequestOptions;
