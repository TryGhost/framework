const Request = require('./request');

class Test extends Request {
    constructor(...args) {
        super(...args);
    }

    // This will eventually house test assertion methods
    // such as .expectStatus
}

module.exports = Test;
