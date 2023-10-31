import {GhostError, GhostErrorOptions} from './GhostError';

export class InternalServerError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 500,
            level: 'critical',
            errorType: 'InternalServerError',
            message: 'The server has encountered an error.',
            ...options
        });
    }
}

export class IncorrectUsageError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 400,
            level: 'critical',
            errorType: 'IncorrectUsageError',
            message: 'We detected a misuse. Please read the stack trace.',
            ...options
        });
    }
}

export class NotFoundError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 404,
            errorType: 'NotFoundError',
            message: 'Resource could not be found.',
            hideStack: true,
            ...options
        });
    }
}

export class BadRequestError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 400,
            errorType: 'BadRequestError',
            message: 'The request could not be understood.',
            ...options
        });
    }
}

export class UnauthorizedError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 401,
            errorType: 'UnauthorizedError',
            message: 'You are not authorised to make this request.',
            ...options
        });
    }
}

export class NoPermissionError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 403,
            errorType: 'NoPermissionError',
            message: 'You do not have permission to perform this request.',
            ...options
        });
    }
}

export class ValidationError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 422,
            errorType: 'ValidationError',
            message: 'The request failed validation.',
            ...options
        });
    }
}

export class UnsupportedMediaTypeError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 415,
            errorType: 'UnsupportedMediaTypeError',
            message: 'The media in the request is not supported by the server.',
            ...options
        });
    }
}

export class TooManyRequestsError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 429,
            errorType: 'TooManyRequestsError',
            message: 'Server has received too many similar requests in a short space of time.',
            ...options
        });
    }
}

export class MaintenanceError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 503,
            errorType: 'MaintenanceError',
            message: 'The server is temporarily down for maintenance.',
            ...options
        });
    }
}

export class MethodNotAllowedError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 405,
            errorType: 'MethodNotAllowedError',
            message: 'Method not allowed for resource.',
            ...options
        });
    }
}

export class RequestNotAcceptableError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 406,
            errorType: 'RequestNotAcceptableError',
            message: 'Request not acceptable for provided Accept-Version header.',
            hideStack: true,
            ...options
        });
    }
}

export class RequestEntityTooLargeError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 413,
            errorType: 'RequestEntityTooLargeError',
            message: 'Request was too big for the server to handle.',
            ...options
        });
    }
}

export class TokenRevocationError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 503,
            errorType: 'TokenRevocationError',
            message: 'Token is no longer available.',
            ...options
        });
    }
}

export class VersionMismatchError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 400,
            errorType: 'VersionMismatchError',
            message: 'Requested version does not match server version.',
            ...options
        });
    }
}

export class DataExportError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 500,
            errorType: 'DataExportError',
            message: 'The server encountered an error whilst exporting data.',
            ...options
        });
    }
}

export class DataImportError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 500,
            errorType: 'DataImportError',
            message: 'The server encountered an error whilst importing data.',
            ...options
        });
    }
}

export class EmailError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 500,
            errorType: 'EmailError',
            message: 'The server encountered an error whilst sending email.',
            ...options
        });
    }
}

export class ThemeValidationError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 422,
            errorType: 'ThemeValidationError',
            message: 'The theme has a validation error.',
            errorDetails: {},
            ...options
        });
    }
}

export class DisabledFeatureError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 409,
            errorType: 'DisabledFeatureError',
            message: 'Unable to complete the request, this feature is disabled.',
            ...options
        });
    }
}

export class UpdateCollisionError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            statusCode: 409,
            errorType: 'UpdateCollisionError',
            message: 'Unable to complete the request, there was a conflict.',
            ...options
        });
    }
}

export class HostLimitError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            errorType: 'HostLimitError',
            hideStack: true,
            statusCode: 403,
            message: 'Unable to complete the request, this resource is limited.',
            ...options
        });
    }
}

export class HelperWarning extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            errorType: 'HelperWarning',
            hideStack: true,
            statusCode: 400,
            message: 'A theme helper has done something unexpected.',
            ...options
        });
    }
}

export class PasswordResetRequiredError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            errorType: 'PasswordResetRequiredError',
            statusCode: 401,
            message: 'For security, you need to create a new password. An email has been sent to you with instructions!',
            ...options
        });
    }
}

export class UnhandledJobError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            errorType: 'UnhandledJobError',
            message: 'Processed job threw an unhandled error',
            level: 'critical',
            ...options
        });
    }
}

export class NoContentError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            errorType: 'NoContentError',
            statusCode: 204,
            hideStack: true,
            ...options
        });
    }
}

export class ConflictError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            errorType: 'ConflictError',
            statusCode: 409,
            message: 'The server has encountered an conflict.',
            ...options
        });
    }
}

export class MigrationError extends GhostError {
    constructor(options: GhostErrorOptions = {}) {
        super({
            errorType: 'MigrationError',
            message: 'An error has occurred applying a database migration.',
            level: 'critical',
            ...options
        });
    }
}
