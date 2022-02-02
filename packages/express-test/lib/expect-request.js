const Request = require('./request');

class ExpectRequest extends Request {
    constructor(...args) {
        super(...args);
    }

    // This will eventually house test assertion methods
    // such as .expectStatus
}

module.exports = ExpectRequest;
