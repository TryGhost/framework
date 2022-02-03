const {Request, RequestOptions} = require('./request');

class ExpectRequest extends Request {
    constructor(...args) {
        super(...args);
    }

    // This will eventually house test assertion methods
    // such as .expectStatus
}

module.exports = ExpectRequest;
module.exports.ExpectRequest = ExpectRequest;
module.exports.RequestOptions = RequestOptions;
