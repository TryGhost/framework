/**
 * Test Utilities
 *
 * Shared utils for writing tests
 */

// Require overrides - these add globals for tests
require('./overrides');

// Require assertions - adds custom should assertions
require('./assertions');

// Custom module mocking code
const modules = require('./modules');

module.exports = Object.assign({}, modules);
