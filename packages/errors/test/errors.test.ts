// Switch these lines once there are useful utils
// const testUtils = require('./utils');
import './utils';

import should from 'should';
import errors, {utils} from '../src';
import {GhostError} from '../src/GhostError';

describe('Errors', function () {
    it('Ensure we inherit from Error', function () {
        const ghostError = new errors.InternalServerError();
        (ghostError instanceof Error).should.eql(true);
    });

    describe('Inherit from other error', function () {
        it('default', function () {
            const someError = new Error() as Error & {context?: string; help?: string};

            someError.message = 'test';
            someError.context = 'test';
            someError.help = 'test';

            const ghostError = new errors.InternalServerError({err: someError});
            ghostError.stack!.should.match(/Error: test/);
            ghostError.context!.should.eql(someError.context);
            ghostError.help!.should.eql(someError.help);
        });

        it('has nested object', function () {
            const someError = new Error() as Error & {obj?: {a: string}};

            someError.obj = {
                a: 'b'
            };

            const ghostError = new errors.InternalServerError({
                err: someError
            }) as Error & {obj?: {a: string}};

            ghostError.obj!.should.eql(someError.obj);
        });

        it('with custom attribute', function () {
            const someError = new Error() as Error & {context?: string};

            someError.context = 'test';

            const ghostError = new errors.InternalServerError({
                err: someError,
                context: 'context'
            });

            ghostError.context!.should.eql('test');
        });

        it('does not overwrite key attributes', function () {
            const someError = new Error() as Error & {errorType?: string; statusCode?: number; level?: string; code?: string};

            someError.errorType = 'test';
            someError.name = 'test';
            someError.statusCode = 0;
            someError.message = 'test';
            someError.level = 'test';
            someError.code = 'TEST_CODE';

            const ghostError = new errors.InternalServerError({
                err: someError,
                code: 'CODE'
            });

            ghostError.errorType!.should.eql('InternalServerError');
            ghostError.name!.should.eql('InternalServerError');
            ghostError.statusCode!.should.eql(500);
            ghostError.message!.should.eql('The server has encountered an error.');
            ghostError.level!.should.eql('critical');
            ghostError.code!.should.eql('CODE');
        });

        it('defaults to the original error code', function () {
            const someError = new Error() as Error & {code?: string};

            someError.code = 'TEST_CODE';

            const ghostError = new errors.InternalServerError({
                err: someError
            });

            ghostError.code!.should.eql('TEST_CODE');
        });

        it('with custom message', function () {
            const someError = new Error();

            const ghostError = new errors.InternalServerError({
                err: someError,
                message: 'test'
            });

            ghostError.message.should.eql('test');
        });

        it('error is string', function () {
            const ghostError = new errors.InternalServerError({
                err: 'string'
            });
            ghostError.stack!.should.match(/Error: string/);
        });
    });

    describe('isGhostError', function () {
        it('can determine non-Ghost errors', function () {
            const isGhostError = utils.isGhostError(new Error());
            isGhostError.should.eql(false);
        });

        it('can determine standard GhostError errors', function () {
            const isGhostError = utils.isGhostError(new errors.NotFoundError());
            isGhostError.should.eql(true);
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

            const err = new CustomNonGhostError({
                message: 'Doesn\'t inherit from GhostError'
            });

            const isGhostError = utils.isGhostError(err);
            isGhostError.should.eql(false);
        });
    });

    describe('Serialization', function () {
        it('Can serialize/deserialize error', function () {
            let err = new errors.BadRequestError({
                help: 'do you need help?',
                context: 'i can\'t help',
                property: 'email'
            });

            let serialized = utils.serialize(err);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (serialized.should as any).be.a.JSONErrorResponse({
                status: 400,
                code: 'BadRequestError',
                title: 'BadRequestError',
                detail: 'The request could not be understood.',
                source: {
                    pointer: '/data/attributes/email'
                },
                meta: {
                    level: 'normal',
                    errorType: 'BadRequestError'
                }
            });

            const deserialized = utils.deserialize(serialized);
            (deserialized instanceof Error).should.eql(true);

            deserialized.id.should.eql(serialized.errors[0].id);
            deserialized.message.should.eql(serialized.errors[0].detail);
            deserialized.name.should.eql(serialized.errors[0].title);
            deserialized.statusCode.should.eql(serialized.errors[0].status);
            deserialized.level.should.eql(serialized.errors[0].meta.level);
            deserialized.help.should.eql(serialized.errors[0].meta.help);
            deserialized.context.should.eql(serialized.errors[0].meta.context);
            deserialized.property.should.eql('email');

            err = new errors.BadRequestError();
            serialized = utils.serialize(err);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (serialized.should as any).be.a.JSONErrorResponse({
                status: 400,
                code: 'BadRequestError',
                title: 'BadRequestError',
                detail: 'The request could not be understood.',
                meta: {
                    level: 'normal',
                    errorType: 'BadRequestError'
                }
            });

            should.not.exist(serialized.errors[0].error);
            should.not.exist(serialized.errors[0].error_description);
        });

        it('cannot serialize nothing', function () {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            utils.serialize(undefined as any).message.should.eql('Something went wrong.');
        });

        it('deserializing nothing results in a plain InternalServerError (the default)', function () {
            utils.deserialize({}).message.should.eql('The server has encountered an error.');
            utils.deserialize({errors: null}).message.should.eql('The server has encountered an error.');
        });

        it('oauth serialize', function () {
            const err = new errors.NoPermissionError({
                message: 'Permissions you need to have.'
            });

            const serialized = utils.serialize(err, {format: 'oauth'});

            serialized.error.should.eql('access_denied');
            serialized.error_description.should.eql('Permissions you need to have.');
            serialized.status.should.eql(403);
            serialized.title.should.eql('NoPermissionError');
            serialized.meta.level.should.eql('normal');

            should.not.exist(serialized.message);
            should.not.exist(serialized.detail);
            should.not.exist(serialized.code);

            const deserialized = utils.deserialize(serialized);

            (deserialized instanceof errors.NoPermissionError).should.eql(true);
            (deserialized instanceof Error).should.eql(true);

            deserialized.id.should.eql(serialized.id);
            deserialized.message.should.eql(serialized.error_description);
            deserialized.name.should.eql(serialized.title);
            deserialized.statusCode.should.eql(serialized.status);
            deserialized.level.should.eql(serialized.meta.level);
        });

        it('[success] deserialize jsonapi, but target error name is unknown', function () {
            const deserialized = utils.deserialize({
                errors: [{
                    name: 'UnknownError',
                    message: 'message'
                }]
            });

            (deserialized instanceof errors.InternalServerError).should.eql(true);
            (deserialized instanceof Error).should.eql(true);

            deserialized.errorType.should.eql('UnknownError');
            deserialized.message.should.eql('message');
        });

        it('[failure] deserialize jsonapi, but obj is empty', function () {
            const deserialized = utils.deserialize({});
            (deserialized instanceof errors.InternalServerError).should.eql(true);
            (deserialized instanceof Error).should.eql(true);
        });

        it('[failure] deserialize oauth, but obj is empty', function () {
            const deserialized = utils.deserialize({});
            (deserialized instanceof errors.InternalServerError).should.eql(true);
            (deserialized instanceof Error).should.eql(true);
        });

        it('[failure] deserialize oauth, but name is not an error name', function () {
            const deserialized = utils.deserialize({name: 'random_oauth_error'});
            (deserialized instanceof errors.InternalServerError).should.eql(true);
            (deserialized instanceof Error).should.eql(true);
        });

        it('[failure] serialize oauth, but obj is empty', function () {
            const serialized = utils.serialize({} as GhostError, {format: 'oauth'});
            serialized.error.should.eql('server_error');
        });
    });

    describe('prepareStackForUser', function () {
        it('Correctly adds Stack Trace header line', function () {
            const testStack = `Error: Line 0 - Message
Stack Line 1
Stack Line 2`;

            const error = new Error('Test');
            error.stack = testStack;

            const {stack} = utils.prepareStackForUser(error);

            stack!.should.eql(`Error: Line 0 - Message
Stack Trace:
Stack Line 1
Stack Line 2`);
        });

        it('Injects context', function () {
            const testStack = `Error: Line 0 - Message
Stack Line 1
Stack Line 2`;

            const error = new Error('Test') as Error & {context?: string};
            error.stack = testStack;
            error.context = 'Line 1 - Context';

            const {stack} = utils.prepareStackForUser(error);

            stack!.should.eql(`Error: Line 0 - Message
Line 1 - Context
Stack Trace:
Stack Line 1
Stack Line 2`);
        });

        it('Injects help', function () {
            const testStack = `Error: Line 0 - Message
Stack Line 1
Stack Line 2`;

            const error = new Error('Test') as Error & {help?: string};
            error.stack = testStack;
            error.help = 'Line 2 - Help';

            const {stack} = utils.prepareStackForUser(error);

            stack!.should.eql(`Error: Line 0 - Message
Line 2 - Help
Stack Trace:
Stack Line 1
Stack Line 2`);
        });

        it('Injects help & context', function () {
            const testStack = `Error: Line 0 - Message
Stack Line 1
Stack Line 2`;

            const error = new Error('Test') as Error & {context?: string; help?: string};
            error.stack = testStack;
            error.context = 'Line 1 - Context';
            error.help = 'Line 2 - Help';

            const {stack} = utils.prepareStackForUser(error);

            stack!.should.eql(`Error: Line 0 - Message
Line 1 - Context
Line 2 - Help
Stack Trace:
Stack Line 1
Stack Line 2`);
        });

        it('removes the code stack in production mode, leaving just error message, context & help', function () {
            const originalMode = process.env.NODE_ENV;

            process.env.NODE_ENV = 'production';
            const testStack = `Error: Line 0 - Message
Stack Line 1
Stack Line 2`;

            const error = new Error('Test') as Error & {context?: string; help?: string};
            error.stack = testStack;
            error.context = 'Line 1 - Context';
            error.help = 'Line 2 - Help';

            const {stack} = utils.prepareStackForUser(error);

            stack!.should.eql(`Error: Line 0 - Message
Line 1 - Context
Line 2 - Help`);

            process.env.NODE_ENV = originalMode;
        });
    });

    describe('ErrorTypes', function () {
        it('InternalServerError', function () {
            const error = new errors.InternalServerError();
            error.statusCode.should.eql(500);
            error.level.should.eql('critical');
            error.errorType.should.eql('InternalServerError');
            error.message.should.eql('The server has encountered an error.');
            error.hideStack.should.be.false();
        });

        it('IncorrectUsageError', function () {
            const error = new errors.IncorrectUsageError();
            error.statusCode.should.eql(400);
            error.level.should.eql('critical');
            error.errorType.should.eql('IncorrectUsageError');
            error.message.should.eql('We detected a misuse. Please read the stack trace.');
            error.hideStack.should.be.false();
        });

        it('NotFoundError', function () {
            const error = new errors.NotFoundError();
            error.statusCode.should.eql(404);
            error.level.should.eql('normal');
            error.errorType.should.eql('NotFoundError');
            error.message.should.eql('Resource could not be found.');
            error.hideStack.should.be.true();
        });

        it('BadRequestError', function () {
            const error = new errors.BadRequestError();
            error.statusCode.should.eql(400);
            error.level.should.eql('normal');
            error.errorType.should.eql('BadRequestError');
            error.message.should.eql('The request could not be understood.');
            error.hideStack.should.be.false();
        });

        it('UnauthorizedError', function () {
            const error = new errors.UnauthorizedError();
            error.statusCode.should.eql(401);
            error.level.should.eql('normal');
            error.errorType.should.eql('UnauthorizedError');
            error.message.should.eql('You are not authorised to make this request.');
            error.hideStack.should.be.false();
        });

        it('NoPermissionError', function () {
            const error = new errors.NoPermissionError();
            error.statusCode.should.eql(403);
            error.level.should.eql('normal');
            error.errorType.should.eql('NoPermissionError');
            error.message.should.eql('You do not have permission to perform this request.');
            error.hideStack.should.be.false();
        });

        it('ValidationError', function () {
            const error = new errors.ValidationError();
            error.statusCode.should.eql(422);
            error.level.should.eql('normal');
            error.errorType.should.eql('ValidationError');
            error.message.should.eql('The request failed validation.');
            error.hideStack.should.be.false();
        });

        it('UnsupportedMediaTypeError', function () {
            const error = new errors.UnsupportedMediaTypeError();
            error.statusCode.should.eql(415);
            error.level.should.eql('normal');
            error.errorType.should.eql('UnsupportedMediaTypeError');
            error.message.should.eql('The media in the request is not supported by the server.');
            error.hideStack.should.be.false();
        });

        it('TooManyRequestsError', function () {
            const error = new errors.TooManyRequestsError();
            error.statusCode.should.eql(429);
            error.level.should.eql('normal');
            error.errorType.should.eql('TooManyRequestsError');
            error.message.should.eql('Server has received too many similar requests in a short space of time.');
            error.hideStack.should.be.false();
        });

        it('MaintenanceError', function () {
            const error = new errors.MaintenanceError();
            error.statusCode.should.eql(503);
            error.level.should.eql('normal');
            error.errorType.should.eql('MaintenanceError');
            error.message.should.eql('The server is temporarily down for maintenance.');
            error.hideStack.should.be.false();
        });

        it('MethodNotAllowedError', function () {
            const error = new errors.MethodNotAllowedError();
            error.statusCode.should.eql(405);
            error.level.should.eql('normal');
            error.errorType.should.eql('MethodNotAllowedError');
            error.message.should.eql('Method not allowed for resource.');
            error.hideStack.should.be.false();
        });

        it('RequestNotAcceptableError', function () {
            const error = new errors.RequestNotAcceptableError();
            error.statusCode.should.eql(406);
            error.level.should.eql('normal');
            error.errorType.should.eql('RequestNotAcceptableError');
            error.message.should.eql('Request not acceptable for provided Accept-Version header.');
            error.hideStack.should.be.true();
        });

        it('RequestEntityTooLargeError', function () {
            const error = new errors.RequestEntityTooLargeError();
            error.statusCode.should.eql(413);
            error.level.should.eql('normal');
            error.errorType.should.eql('RequestEntityTooLargeError');
            error.message.should.eql('Request was too big for the server to handle.');
            error.hideStack.should.be.false();
        });

        it('RangeNotSatisfiableError', function () {
            const error = new errors.RangeNotSatisfiableError();
            error.statusCode.should.eql(416);
            error.level.should.eql('normal');
            error.errorType.should.eql('RangeNotSatisfiableError');
            error.message.should.eql('Range not satisfiable for provided Range header.');
            error.hideStack.should.be.true();
        });

        it('TokenRevocationError', function () {
            const error = new errors.TokenRevocationError();
            error.statusCode.should.eql(503);
            error.level.should.eql('normal');
            error.errorType.should.eql('TokenRevocationError');
            error.message.should.eql('Token is no longer available.');
            error.hideStack.should.be.false();
        });

        it('VersionMismatchError', function () {
            const error = new errors.VersionMismatchError();
            error.statusCode.should.eql(400);
            error.level.should.eql('normal');
            error.errorType.should.eql('VersionMismatchError');
            error.message.should.eql('Requested version does not match server version.');
            error.hideStack.should.be.false();
        });

        it('DataExportError', function () {
            const error = new errors.DataExportError();
            error.statusCode.should.eql(500);
            error.level.should.eql('normal');
            error.errorType.should.eql('DataExportError');
            error.message.should.eql('The server encountered an error whilst exporting data.');
            error.hideStack.should.be.false();
        });

        it('DataImportError', function () {
            const error = new errors.DataImportError();
            error.statusCode.should.eql(500);
            error.level.should.eql('normal');
            error.errorType.should.eql('DataImportError');
            error.message.should.eql('The server encountered an error whilst importing data.');
            error.hideStack.should.be.false();
        });

        it('EmailError', function () {
            const error = new errors.EmailError();
            error.statusCode.should.eql(500);
            error.level.should.eql('normal');
            error.errorType.should.eql('EmailError');
            error.message.should.eql('The server encountered an error whilst sending email.');
            error.hideStack.should.be.false();
        });

        it('ThemeValidationError', function () {
            const error = new errors.ThemeValidationError();
            error.statusCode.should.eql(422);
            error.level.should.eql('normal');
            error.errorType.should.eql('ThemeValidationError');
            error.message.should.eql('The theme has a validation error.');
            error.hideStack.should.be.false();
            // Extra property
            error.errorDetails.should.be.an.Object();
        });

        it('DisabledFeatureError', function () {
            const error = new errors.DisabledFeatureError();
            error.statusCode.should.eql(409);
            error.level.should.eql('normal');
            error.errorType.should.eql('DisabledFeatureError');
            error.message.should.eql('Unable to complete the request, this feature is disabled.');
            error.hideStack.should.be.false();
        });

        it('UpdateCollisionError', function () {
            const error = new errors.UpdateCollisionError();
            error.statusCode.should.eql(409);
            error.level.should.eql('normal');
            error.errorType.should.eql('UpdateCollisionError');
            error.message.should.eql('Unable to complete the request, there was a conflict.');
            error.hideStack.should.be.false();
        });

        it('HostLimitError', function () {
            const error = new errors.HostLimitError();
            error.statusCode.should.eql(403);
            error.level.should.eql('normal');
            error.errorType.should.eql('HostLimitError');
            error.message.should.eql('Unable to complete the request, this resource is limited.');
            error.hideStack.should.be.true();
        });

        // Not sure this error makes sense either
        it('HelperWarning', function () {
            const error = new errors.HelperWarning();
            error.statusCode.should.eql(400);
            error.level.should.eql('normal');
            error.errorType.should.eql('HelperWarning');
            error.message.should.eql('A theme helper has done something unexpected.');
            error.hideStack.should.be.true();
        });

        it('PasswordResetRequiredError', function () {
            const error = new errors.PasswordResetRequiredError();
            error.statusCode.should.eql(401);
            error.level.should.eql('normal');
            error.errorType.should.eql('PasswordResetRequiredError');
            error.message.should.eql('For security, you need to create a new password. An email has been sent to you with instructions!');
            error.hideStack.should.be.false();
        });

        it('UnhandledJobError', function () {
            const error = new errors.UnhandledJobError();
            error.statusCode.should.eql(500);
            error.level.should.eql('critical');
            error.errorType.should.eql('UnhandledJobError');
            error.message.should.eql('Processed job threw an unhandled error');
            error.hideStack.should.be.false();
        });

        // This error doesn't make sense because it has an OK status code..
        // I think this should have been an EmptyImageError with a 400
        it('NoContentError', function () {
            const error = new errors.NoContentError();
            error.statusCode.should.eql(204);
            error.level.should.eql('normal');
            error.errorType.should.eql('NoContentError');
            error.message.should.eql('The server has encountered an error.');
            error.hideStack.should.be.true();
        });

        it('ConflictError', function () {
            const error = new errors.ConflictError();
            error.statusCode.should.eql(409);
            error.level.should.eql('normal');
            error.errorType.should.eql('ConflictError');
            error.message.should.eql('The server has encountered an conflict.');
            error.hideStack.should.be.false();
        });

        it('MigrationError', function () {
            const error = new errors.MigrationError();
            error.statusCode.should.eql(500);
            error.level.should.eql('critical');
            error.errorType.should.eql('MigrationError');
            error.message.should.eql('An error has occurred applying a database migration.');
            error.hideStack.should.be.false();
        });
    });
});
