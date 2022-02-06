/**
 * Test Utilities
 *
 * Shared utils for writing tests
 */

const sinon = require('sinon');

// Require overrides - these add globals for tests
module.exports = {
    sinon,
    assert: require('assert')
};
