const assert = require('assert/strict');
const {url} = require('../');

describe('Lib: Security - URL', function () {
    it('encodes and decodes URL-safe base64 values', function () {
        const original = 'YWJjKysvLz0='; // abc++//=
        const encoded = url.encodeBase64(original);
        const decoded = url.decodeBase64(encoded);

        assert.equal(encoded.includes('+'), false);
        assert.equal(encoded.includes('/'), false);
        assert.equal(encoded.includes('='), false);
        assert.equal(decoded, original);
    });
});
