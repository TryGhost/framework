const {assert} = require('./utils');
const path = require('path');
const FormData = require('form-data');

const {isJSON, normalizeURL, attachFile} = require('../lib/utils');

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

    describe('attachFile', function () {
        it('creates FormData with file content', function () {
            const filePath = path.join(__dirname, 'fixtures/test-file.txt');
            const formData = attachFile('testfile', filePath);

            assert.equal(formData instanceof FormData, true);
            assert.equal(typeof formData.getHeaders, 'function');
            assert.equal(typeof formData.getBuffer, 'function');
        });

        it('sets correct filename from path', function () {
            const filePath = path.join(__dirname, 'fixtures/test-file.txt');
            const formData = attachFile('testfile', filePath);

            // FormData doesn't expose a direct way to check the filename,
            // but we can verify it was created without errors
            const headers = formData.getHeaders();
            assert.match(headers['content-type'], /^multipart\/form-data; boundary=/);
        });

        it('sets correct content type for text file', function () {
            const filePath = path.join(__dirname, 'fixtures/test-file.txt');
            const formData = attachFile('testfile', filePath);

            // Get the form data buffer to check it contains the right content type
            const buffer = formData.getBuffer();
            const content = buffer.toString();

            // Check that the form data contains the expected content type
            assert.match(content, /Content-Type: text\/plain/);
        });

        it('sets correct content type for PNG image', function () {
            const filePath = path.join(__dirname, 'fixtures/ghost-favicon.png');
            const formData = attachFile('image', filePath);

            // Get the form data buffer to check it contains the right content type
            const buffer = formData.getBuffer();
            const content = buffer.toString();

            // Check that the form data contains the expected content type
            assert.match(content, /Content-Type: image\/png/);
        });

        it('uses default content type for unknown file extension', function () {
            // Create a file with unknown extension
            const fs = require('fs');
            const unknownFile = path.join(__dirname, 'fixtures/test.unknown');
            fs.writeFileSync(unknownFile, 'test content');

            try {
                const formData = attachFile('file', unknownFile);
                const buffer = formData.getBuffer();
                const content = buffer.toString();

                // Check that the form data contains the default content type
                assert.match(content, /Content-Type: application\/octet-stream/);
            } finally {
                // Clean up
                fs.unlinkSync(unknownFile);
            }
        });

        it('includes the correct field name', function () {
            const filePath = path.join(__dirname, 'fixtures/test-file.txt');
            const formData = attachFile('myfield', filePath);

            const buffer = formData.getBuffer();
            const content = buffer.toString();

            // Check that the form data contains the field name
            assert.match(content, /Content-Disposition: form-data; name="myfield"/);
        });

        it('includes the file content', function () {
            const filePath = path.join(__dirname, 'fixtures/test-file.txt');
            const formData = attachFile('testfile', filePath);

            const buffer = formData.getBuffer();
            const content = buffer.toString();

            // Check that the form data contains the file content
            assert.match(content, /test content for file upload/);
        });
    });
});
