import assert from 'assert/strict';

import errors from '../src';
import * as utils from '../src/utils';

type AnyRecord = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('Error Utils', function () {
    describe('prepareStackForUser', function () {
        it('handles errors without stack', function () {
            const error = new Error('no stack');
            error.stack = undefined;

            const processedError = utils.prepareStackForUser(error);
            assert.equal(processedError.stack, 'Stack Trace:');
        });

        it('returns full error clone of nested errors', function () {
            const originalError = new Error('I am the original one!') as Error & {
                custom?: string;
            };
            originalError.custom = 'I am custom!';

            const ghostError = new errors.ValidationError({
                message: 'mistakes were made',
                help: 'help yourself',
                errorDetails: {
                    originalError: originalError,
                },
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

        it('deep clones array values in errorDetails', function () {
            const items = [{ id: 1 }, { id: 2 }];
            const ghostError = new errors.ValidationError({
                message: 'mistakes were made',
                errorDetails: items,
            });

            const processedError = utils.prepareStackForUser(ghostError);

            assert.deepEqual(processedError.errorDetails, items);
            items[0].id = 999;
            assert.equal(processedError.errorDetails[0].id, 1);
        });

        it('preserves Date values in errorDetails', function () {
            const serverUpdatedAt = new Date('2026-10-09T10:00:00.000Z');
            const ghostError = new errors.UpdateCollisionError({
                message: 'Saving failed! Someone else is editing this post.',
                errorDetails: {
                    serverUpdatedAt,
                },
            });

            const processedError = utils.prepareStackForUser(ghostError);
            const clonedDate = processedError.errorDetails.serverUpdatedAt;

            assert.ok(clonedDate instanceof Date);
            assert.notEqual(clonedDate, serverUpdatedAt);
            assert.equal(clonedDate.getTime(), serverUpdatedAt.getTime());
            assert.deepEqual(JSON.parse(JSON.stringify(processedError.errorDetails)), {
                serverUpdatedAt: '2026-10-09T10:00:00.000Z',
            });
        });

        it('clones errors with circular references without throwing', function () {
            const innerError = new Error('inner') as Error & { self?: unknown; meta?: AnyRecord };
            innerError.self = innerError;
            innerError.meta = { owner: innerError, list: [] as unknown[] };
            innerError.meta.list.push(innerError.meta);

            const ghostError = new errors.InternalServerError({
                message: 'wrapped',
                err: innerError,
            });
            const nested = ghostError as unknown as { err?: unknown; stack?: string };
            nested.err = innerError;

            const processedError = utils.prepareStackForUser(ghostError) as unknown as {
                err: Error & { self: unknown; meta: AnyRecord };
                stack: string;
            };
            const clonedInner = processedError.err;

            assert.notEqual(clonedInner, innerError);
            assert.equal(clonedInner.message, 'inner');
            assert.equal(clonedInner.self, clonedInner);
            assert.notEqual(clonedInner.meta, innerError.meta);
            assert.equal(clonedInner.meta.owner, clonedInner);
            assert.equal(clonedInner.meta.list[0], clonedInner.meta);

            assert.notEqual(processedError.stack, ghostError.stack);
        });

        it('keeps non-plain objects by reference', function () {
            class FakeResponse {
                statusCode = 403;
                body: { response?: FakeResponse } = {};
                constructor() {
                    this.body.response = this;
                }
            }
            const response = new FakeResponse();
            const awsError = new Error('Access Denied') as Error & { $response?: FakeResponse };
            awsError.$response = response;

            const ghostError = new errors.InternalServerError({
                message: 'wrapped',
                err: awsError,
            });
            (ghostError as unknown as { err?: unknown }).err = awsError;

            const processedError = utils.prepareStackForUser(ghostError) as unknown as {
                err: Error & { $response: FakeResponse };
            };

            assert.notEqual(processedError.err, awsError);
            assert.equal(processedError.err.$response, response);
        });

        it('Preserves the stack trace', function () {
            const errorCreatingFunction = () => {
                return new Error('Original error');
            };
            const originalError = errorCreatingFunction();
            const ghostError = new errors.EmailError({
                message: 'Ghost error',
                err: originalError,
            });

            assert.equal(ghostError.stack!.includes('errorCreatingFunction'), true);
        });
    });
});
