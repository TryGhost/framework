const assert = require('assert');

const errors = require('..');
const utils = require('../lib/utils');

describe('Error Utils', function () {
    describe('prepareStackForUser', function () {
        it('returns full error clone of nested errors', function () {
            const originalError = new Error({
                message: 'I am the original one!'
            });
            const ghostError = new errors.ValidationError({
                message: 'mistakes were made',
                help: 'help yourself',
                errorDetails: {
                    originalError: originalError
                }
            });

            const processedError = utils.prepareStackForUser(ghostError);

            assert.notEqual(processedError, ghostError);
            assert.equal(processedError.message, ghostError.message);
            assert.equal(processedError.errorType, ghostError.errorType);

            assert.equal(processedError.errorDetails.originalError.message, originalError.message);

            originalError.message = 'changed';
            assert.notEqual(processedError.message, originalError.message);
        });
    });
});