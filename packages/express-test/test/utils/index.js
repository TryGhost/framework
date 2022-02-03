/**
 * Test Utilities
 *
 * Shared utils for writing tests
 */

const sinon = require('sinon');

const stubCookies = (request) => {
    const saveCookiesStub = request._saveCookies = sinon.stub();
    const restoreCookiesStub = request._restoreCookies = sinon.stub();
    return {saveCookiesStub, restoreCookiesStub};
};

// Require overrides - these add globals for tests
module.exports = {
    sinon,
    assert: require('assert'),
    stubCookies
};
