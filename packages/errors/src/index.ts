import { GhostError } from './GhostError';
import * as ghostErrors from './errors';
import { deserialize, isGhostError, prepareStackForUser, serialize } from './utils';
import { formatZodIssues, fromZodError, getZodErrorDetails, isZodError } from './zod';

export * from './errors';
export type { GhostError };
export type { GhostErrorConstructor, ZodErrorDetail, ZodErrorLike, ZodIssueLike } from './zod';
export default ghostErrors;

export const utils = {
    serialize,
    deserialize,
    isGhostError,
    prepareStackForUser,
    isZodError,
    formatZodIssues,
    getZodErrorDetails,
    fromZodError,
};
