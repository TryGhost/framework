import assert from 'assert/strict';

import errors from '../src';
import * as utils from '../src/utils';

describe('Error Utils', function () {
    describe('prepareStackForUser', function () {
        it('returns full error clone of nested errors', function () {
            const originalError = new Error('I am the original one!') as Error & {custom?: string};
            originalError.custom = 'I am custom!';

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
            assert.equal(processedError.errorDetails.originalError.custom, originalError.custom);

            originalError.message = 'changed';
            assert.notEqual(processedError.message, originalError.message);
        });

        it('Preserves the stack trace', function () {
            const errorCreatingFunction = () => {
                return new Error('Original error');
            };
            const originalError = errorCreatingFunction();
            const ghostError = new errors.EmailError({
                message: 'Ghost error',
                err: originalError
            });

            assert.equal(ghostError.stack!.includes('errorCreatingFunction'), true);
        });
    });
});
