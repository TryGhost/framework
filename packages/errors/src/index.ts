import {GhostError} from './GhostError';
import * as ghostErrors from './errors';
import {deserialize, isGhostError, prepareStackForUser, serialize} from './utils';

export * from './errors';
export default ghostErrors;

const ghostErrorsWithBase = {...ghostErrors, GhostError};

export const utils = {
    serialize: serialize.bind(ghostErrorsWithBase),
    deserialize: deserialize.bind(ghostErrorsWithBase),
    isGhostError: isGhostError.bind(ghostErrorsWithBase),
    prepareStackForUser: prepareStackForUser
};
