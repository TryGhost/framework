import assert from 'assert/strict';
import errors, {utils} from '../src';
import {GhostError} from '../src/GhostError';

type GhostErrorConstructor = new (options?: Record<string, unknown>) => GhostError;

function containsSubset(actual: any, expected: any): boolean {
    if (expected === null || typeof expected !== 'object') {
        return actual === expected;
    }

    return Object.entries(expected).every(([key, value]) => {
        return containsSubset(actual?.[key], value);
    });
}

function expectJSONErrorResponse(serialized: any, expected: any) {
    assert.ok(serialized);
    assert.ok(Array.isArray(serialized.errors));
    assert.ok(serialized.errors.length > 0);

    for (const err of serialized.errors) {
        assert.equal(typeof err, 'object');
        for (const key of ['id', 'title', 'detail', 'status', 'code', 'meta']) {
            assert.ok(Object.prototype.hasOwnProperty.call(err, key));
        }
    }

    assert.ok(serialized.errors.some((err: any) => containsSubset(err, expected)));
}

describe('Errors', function () {
    it('Ensure we inherit from Error', function () {
        const ghostError = new errors.InternalServerError();
        assert.equal(ghostError instanceof Error, true);
    });

    describe('Inherit from other error', function () {
        it('default', function () {
            const someError = new Error() as Error & {context?: string; help?: string};
            someError.message = 'test';
            someError.context = 'test';
            someError.help = 'test';

            const ghostError = new errors.InternalServerError({err: someError});
            assert.match(ghostError.stack!, /Error: test/);
            assert.equal(ghostError.context, someError.context);
            assert.equal(ghostError.help, someError.help);
        });

        it('has nested object', function () {
            const someError = new Error() as Error & {obj?: {a: string}};
            someError.obj = {a: 'b'};

            const ghostError = new errors.InternalServerError({err: someError}) as Error & {obj?: {a: string}};
            assert.deepEqual(ghostError.obj, someError.obj);
        });

        it('with custom attribute', function () {
            const someError = new Error() as Error & {context?: string};
            someError.context = 'test';

            const ghostError = new errors.InternalServerError({err: someError, context: 'context'});
            assert.equal(ghostError.context, 'test');
        });

        it('does not overwrite key attributes', function () {
            const someError = new Error() as Error & {errorType?: string; statusCode?: number; level?: string; code?: string};
            someError.errorType = 'test';
            someError.name = 'test';
            someError.statusCode = 0;
            someError.message = 'test';
            someError.level = 'test';
            someError.code = 'TEST_CODE';

            const ghostError = new errors.InternalServerError({err: someError, code: 'CODE'});

            assert.equal(ghostError.errorType, 'InternalServerError');
            assert.equal(ghostError.name, 'InternalServerError');
            assert.equal(ghostError.statusCode, 500);
            assert.equal(ghostError.message, 'The server has encountered an error.');
            assert.equal(ghostError.level, 'critical');
            assert.equal(ghostError.code, 'CODE');
        });

        it('defaults to the original error code', function () {
            const someError = new Error() as Error & {code?: string};
            someError.code = 'TEST_CODE';

            const ghostError = new errors.InternalServerError({err: someError});
            assert.equal(ghostError.code, 'TEST_CODE');
        });

        it('with custom message', function () {
            const someError = new Error();
            const ghostError = new errors.InternalServerError({err: someError, message: 'test'});
            assert.equal(ghostError.message, 'test');
        });

        it('error is string', function () {
            const ghostError = new errors.InternalServerError({err: 'string'});
            assert.match(ghostError.stack!, /Error: string/);
        });

        it('supports explicit errorType option and mirrors name', function () {
            const error = new GhostError({errorType: 'CustomErrorType'});
            assert.equal(error.errorType, 'CustomErrorType');
            assert.equal(error.name, 'CustomErrorType');
        });

        it('uses default errorType when one is not provided', function () {
            const error = new GhostError();
            assert.equal(error.errorType, 'InternalServerError');
            assert.equal(error.name, 'InternalServerError');
        });

        it('preserves existing property values when inherited error property is falsy', function () {
            const someError = new Error() as Error & {context?: string};
            someError.context = '';

            const ghostError = new errors.InternalServerError({
                err: someError,
                context: 'context-value'
            });

            assert.equal(ghostError.context, 'context-value');
        });
    });

    describe('isGhostError', function () {
        it('can determine non-Ghost errors', function () {
            assert.equal(utils.isGhostError(new Error()), false);
        });

        it('can determine standard GhostError errors', function () {
            assert.equal(utils.isGhostError(new errors.NotFoundError()), true);
        });

        it('can determine new non-GhostError errors', function () {
            class NonGhostError extends Error {
                constructor(options: {message: string}) {
                    super(options.message);
                }
            }

            class CustomNonGhostError extends NonGhostError {
                constructor(options: {message: string}) {
                    super(options);
                }
            }

            const err = new CustomNonGhostError({message: 'Does not inherit from GhostError'});
            assert.equal(utils.isGhostError(err), false);
        });
    });

    describe('Serialization', function () {
        it('Can serialize/deserialize error', function () {
            let err = new errors.BadRequestError({
                help: 'do you need help?',
                context: 'i cannot help',
                property: 'email'
            });

            let serialized = utils.serialize(err);
            expectJSONErrorResponse(serialized, {
                status: 400,
                code: 'BadRequestError',
                title: 'BadRequestError',
                detail: 'The request could not be understood.',
                source: {pointer: '/data/attributes/email'},
                meta: {
                    level: 'normal',
                    errorType: 'BadRequestError',
                    context: 'i cannot help',
                    help: 'do you need help?'
                }
            });

            const deserialized = utils.deserialize(serialized);
            assert.equal(deserialized instanceof Error, true);
            assert.equal(deserialized.id, serialized.errors[0].id);
            assert.equal(deserialized.message, serialized.errors[0].detail);
            assert.equal(deserialized.name, serialized.errors[0].title);
            assert.equal(deserialized.statusCode, serialized.errors[0].status);
            assert.equal(deserialized.level, serialized.errors[0].meta.level);
            assert.equal(deserialized.help, serialized.errors[0].meta.help);
            assert.equal(deserialized.context, serialized.errors[0].meta.context);
            assert.equal(deserialized.property, 'email');

            err = new errors.BadRequestError();
            serialized = utils.serialize(err);

            expectJSONErrorResponse(serialized, {
                status: 400,
                code: 'BadRequestError',
                title: 'BadRequestError',
                detail: 'The request could not be understood.',
                meta: {
                    level: 'normal',
                    errorType: 'BadRequestError'
                }
            });

            assert.equal(serialized.errors[0].error, undefined);
            assert.equal(serialized.errors[0].error_description, undefined);
        });

        it('cannot serialize nothing', function () {
            assert.equal((utils.serialize(undefined as any) as any).message, 'Something went wrong.');
        });

        it('deserializing nothing results in a plain InternalServerError (the default)', function () {
            assert.equal(utils.deserialize({}).message, 'The server has encountered an error.');
            assert.equal(utils.deserialize({errors: null as any}).message, 'The server has encountered an error.');
            assert.equal(utils.deserialize({errors: [] as any[]}).message, 'The server has encountered an error.');
        });

        it('oauth serialize', function () {
            const err = new errors.NoPermissionError({message: 'Permissions you need to have.'});
            const serialized = utils.serialize(err, {format: 'oauth'} as any);

            assert.equal(serialized.error, 'access_denied');
            assert.equal(serialized.error_description, 'Permissions you need to have.');
            assert.equal(serialized.status, 403);
            assert.equal(serialized.title, 'NoPermissionError');
            assert.equal(serialized.meta.level, 'normal');

            assert.equal(serialized.message, undefined);
            assert.equal(serialized.detail, undefined);
            assert.equal(serialized.code, undefined);

            const deserialized = utils.deserialize(serialized);
            assert.equal(deserialized instanceof errors.NoPermissionError, true);
            assert.equal(deserialized instanceof Error, true);

            assert.equal(deserialized.id, serialized.id);
            assert.equal(deserialized.message, serialized.error_description);
            assert.equal(deserialized.name, serialized.title);
            assert.equal(deserialized.statusCode, serialized.status);
            assert.equal(deserialized.level, serialized.meta.level);
        });

        it('[success] deserialize jsonapi, but target error name is unknown', function () {
            const deserialized = utils.deserialize({
                errors: [{
                    name: 'UnknownError',
                    message: 'message'
                }]
            });

            assert.equal(deserialized instanceof errors.InternalServerError, true);
            assert.equal(deserialized instanceof Error, true);
            assert.equal(deserialized.errorType, 'UnknownError');
            assert.equal(deserialized.message, 'message');
        });

        it('[failure] deserialize oauth, but name is not an error name', function () {
            const deserialized = utils.deserialize({name: 'random_oauth_error'} as any);
            assert.equal(deserialized instanceof errors.InternalServerError, true);
            assert.equal(deserialized instanceof Error, true);
        });

        it('[failure] serialize oauth, but obj is empty', function () {
            const serialized = utils.serialize({} as GhostError, {format: 'oauth'} as any);
            assert.equal(serialized.error, 'server_error');
        });

        it('deserialize jsonapi known title path', function () {
            const deserialized = utils.deserialize({
                errors: [{
                    title: 'BadRequestError',
                    detail: 'bad',
                    status: 400,
                    code: 'BadRequestError',
                    meta: {level: 'normal'},
                    source: {
                        pointer: '/data/attributes/email'
                    }
                }]
            });

            assert.equal(deserialized instanceof errors.BadRequestError, true);
            assert.equal(deserialized.message, 'bad');
            assert.equal(deserialized.property, 'email');
        });
    });

    describe('prepareStackForUser', function () {
        it('Correctly adds Stack Trace header line', function () {
            const testStack = `Error: Line 0 - Message\nStack Line 1\nStack Line 2`;
            const error = new Error('Test');
            error.stack = testStack;

            const {stack} = utils.prepareStackForUser(error);
            assert.equal(stack, `Error: Line 0 - Message\nStack Trace:\nStack Line 1\nStack Line 2`);
        });

        it('Injects context', function () {
            const error = new Error('Test') as Error & {context?: string};
            error.stack = `Error: Line 0 - Message\nStack Line 1\nStack Line 2`;
            error.context = 'Line 1 - Context';

            const {stack} = utils.prepareStackForUser(error);
            assert.equal(stack, `Error: Line 0 - Message\nLine 1 - Context\nStack Trace:\nStack Line 1\nStack Line 2`);
        });

        it('Injects help', function () {
            const error = new Error('Test') as Error & {help?: string};
            error.stack = `Error: Line 0 - Message\nStack Line 1\nStack Line 2`;
            error.help = 'Line 2 - Help';

            const {stack} = utils.prepareStackForUser(error);
            assert.equal(stack, `Error: Line 0 - Message\nLine 2 - Help\nStack Trace:\nStack Line 1\nStack Line 2`);
        });

        it('Injects help & context', function () {
            const error = new Error('Test') as Error & {context?: string; help?: string};
            error.stack = `Error: Line 0 - Message\nStack Line 1\nStack Line 2`;
            error.context = 'Line 1 - Context';
            error.help = 'Line 2 - Help';

            const {stack} = utils.prepareStackForUser(error);
            assert.equal(stack, `Error: Line 0 - Message\nLine 1 - Context\nLine 2 - Help\nStack Trace:\nStack Line 1\nStack Line 2`);
        });

        it('removes the code stack in production mode, leaving just error message, context & help', function () {
            const originalMode = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new Error('Test') as Error & {context?: string; help?: string};
            error.stack = `Error: Line 0 - Message\nStack Line 1\nStack Line 2`;
            error.context = 'Line 1 - Context';
            error.help = 'Line 2 - Help';

            const {stack} = utils.prepareStackForUser(error);
            assert.equal(stack, `Error: Line 0 - Message\nLine 1 - Context\nLine 2 - Help`);

            process.env.NODE_ENV = originalMode;
        });
    });

    describe('ErrorTypes', function () {
        const expectations: Array<[GhostErrorConstructor, Partial<GhostError> & {message: string}]> = [
            [errors.InternalServerError, {statusCode: 500, level: 'critical', errorType: 'InternalServerError', message: 'The server has encountered an error.', hideStack: false}],
            [errors.IncorrectUsageError, {statusCode: 400, level: 'critical', errorType: 'IncorrectUsageError', message: 'We detected a misuse. Please read the stack trace.', hideStack: false}],
            [errors.NotFoundError, {statusCode: 404, level: 'normal', errorType: 'NotFoundError', message: 'Resource could not be found.', hideStack: true}],
            [errors.BadRequestError, {statusCode: 400, level: 'normal', errorType: 'BadRequestError', message: 'The request could not be understood.', hideStack: false}],
            [errors.UnauthorizedError, {statusCode: 401, level: 'normal', errorType: 'UnauthorizedError', message: 'You are not authorised to make this request.', hideStack: false}],
            [errors.NoPermissionError, {statusCode: 403, level: 'normal', errorType: 'NoPermissionError', message: 'You do not have permission to perform this request.', hideStack: false}],
            [errors.ValidationError, {statusCode: 422, level: 'normal', errorType: 'ValidationError', message: 'The request failed validation.', hideStack: false}],
            [errors.UnsupportedMediaTypeError, {statusCode: 415, level: 'normal', errorType: 'UnsupportedMediaTypeError', message: 'The media in the request is not supported by the server.', hideStack: false}],
            [errors.TooManyRequestsError, {statusCode: 429, level: 'normal', errorType: 'TooManyRequestsError', message: 'Server has received too many similar requests in a short space of time.', hideStack: false}],
            [errors.MaintenanceError, {statusCode: 503, level: 'normal', errorType: 'MaintenanceError', message: 'The server is temporarily down for maintenance.', hideStack: false}],
            [errors.MethodNotAllowedError, {statusCode: 405, level: 'normal', errorType: 'MethodNotAllowedError', message: 'Method not allowed for resource.', hideStack: false}],
            [errors.RequestNotAcceptableError, {statusCode: 406, level: 'normal', errorType: 'RequestNotAcceptableError', message: 'Request not acceptable for provided Accept-Version header.', hideStack: true}],
            [errors.RequestEntityTooLargeError, {statusCode: 413, level: 'normal', errorType: 'RequestEntityTooLargeError', message: 'Request was too big for the server to handle.', hideStack: false}],
            [errors.RangeNotSatisfiableError, {statusCode: 416, level: 'normal', errorType: 'RangeNotSatisfiableError', message: 'Range not satisfiable for provided Range header.', hideStack: true}],
            [errors.TokenRevocationError, {statusCode: 503, level: 'normal', errorType: 'TokenRevocationError', message: 'Token is no longer available.', hideStack: false}],
            [errors.VersionMismatchError, {statusCode: 400, level: 'normal', errorType: 'VersionMismatchError', message: 'Requested version does not match server version.', hideStack: false}],
            [errors.DataExportError, {statusCode: 500, level: 'normal', errorType: 'DataExportError', message: 'The server encountered an error whilst exporting data.', hideStack: false}],
            [errors.DataImportError, {statusCode: 500, level: 'normal', errorType: 'DataImportError', message: 'The server encountered an error whilst importing data.', hideStack: false}],
            [errors.EmailError, {statusCode: 500, level: 'normal', errorType: 'EmailError', message: 'The server encountered an error whilst sending email.', hideStack: false}],
            [errors.ThemeValidationError, {statusCode: 422, level: 'normal', errorType: 'ThemeValidationError', message: 'The theme has a validation error.', hideStack: false}],
            [errors.DisabledFeatureError, {statusCode: 409, level: 'normal', errorType: 'DisabledFeatureError', message: 'Unable to complete the request, this feature is disabled.', hideStack: false}],
            [errors.UpdateCollisionError, {statusCode: 409, level: 'normal', errorType: 'UpdateCollisionError', message: 'Unable to complete the request, there was a conflict.', hideStack: false}],
            [errors.HostLimitError, {statusCode: 403, level: 'normal', errorType: 'HostLimitError', message: 'Unable to complete the request, this resource is limited.', hideStack: true}],
            [errors.HelperWarning, {statusCode: 400, level: 'normal', errorType: 'HelperWarning', message: 'A theme helper has done something unexpected.', hideStack: true}],
            [errors.PasswordResetRequiredError, {statusCode: 401, level: 'normal', errorType: 'PasswordResetRequiredError', message: 'For security, you need to create a new password. An email has been sent to you with instructions!', hideStack: false}],
            [errors.UnhandledJobError, {statusCode: 500, level: 'critical', errorType: 'UnhandledJobError', message: 'Processed job threw an unhandled error', hideStack: false}],
            [errors.NoContentError, {statusCode: 204, level: 'normal', errorType: 'NoContentError', message: 'The server has encountered an error.', hideStack: true}],
            [errors.ConflictError, {statusCode: 409, level: 'normal', errorType: 'ConflictError', message: 'The server has encountered an conflict.', hideStack: false}],
            [errors.MigrationError, {statusCode: 500, level: 'critical', errorType: 'MigrationError', message: 'An error has occurred applying a database migration.', hideStack: false}]
        ];

        for (const [ErrorClass, expected] of expectations) {
            it(ErrorClass.name, function () {
                const error = new ErrorClass();
                assert.equal(error.statusCode, expected.statusCode);
                assert.equal(error.level, expected.level);
                assert.equal(error.errorType, expected.errorType);
                assert.equal(error.message, expected.message);
                assert.equal(error.hideStack, expected.hideStack);

                if (ErrorClass === errors.ThemeValidationError) {
                    assert.equal(typeof (error as any).errorDetails, 'object');
                }
            });
        }
    });
});
