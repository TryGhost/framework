const {assert} = require('./utils');

const {isJSON, normalizeURL} = require('../lib/utils');

describe('Utils', function () {
    it('isJSON', function () {
        assert.equal(isJSON('application/json'), true);
        assert.equal(isJSON('application/ld+json'), true);
        assert.equal(isJSON('text/html'), false);
    });

    describe('normalizeURL', function () {
        it('adds trailing slash in the end of URL', function () {
            const url = normalizeURL('http://example.com');
            assert.equal(url, 'http://example.com/');
        });

        it('does NOT add trailing slash in the end of URL if it is present', function () {
            const url = normalizeURL('http://example.com/');
            assert.equal(url, 'http://example.com/');
        });

        it('adds trailing slash in the end of URL respecting query string', function () {
            const url = normalizeURL('http://example.com?yolo=9000');
            assert.equal(url, 'http://example.com/?yolo=9000');
        });

        it('does NOT add trailing slash in the end of URL respecting query string', function () {
            const url = normalizeURL('http://example.com/?yolo=9000');
            assert.equal(url, 'http://example.com/?yolo=9000');
        });
    });
});
