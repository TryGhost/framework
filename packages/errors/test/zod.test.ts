import assert from 'assert/strict';
import * as z3 from 'zod/v3';
import * as z4 from 'zod/v4';

import errors, { utils } from '../src';

const zodVersions = [
    ['zod v3', z3],
    ['zod v4', z4],
] as const;

describe('Zod utils', function () {
    for (const [label, z] of zodVersions) {
        describe(label, function () {
            const schema = z.object({
                email: z.string().email(),
                tags: z.array(z.object({ name: z.string() })),
            });

            const getError = () => {
                const result = schema.safeParse({ email: 'nope', tags: [{}] });
                assert.equal(result.success, false);
                return result.error!;
            };

            it('detects zod errors', function () {
                assert.equal(utils.isZodError(getError()), true);
            });

            it('formats issues with paths', function () {
                const message = utils.formatZodIssues(getError().issues);
                assert.match(message, /^email: .+; tags\[0\]\.name: .+$/);
            });

            it('creates a ValidationError by default', function () {
                const zodError = getError();
                const error = utils.fromZodError(zodError);

                assert.ok(error instanceof errors.ValidationError);
                assert.equal(error.statusCode, 422);
                assert.equal(error.message, utils.formatZodIssues(zodError.issues));
                assert.equal(error.property, 'email');
                assert.deepEqual(
                    error.errorDetails.map((detail: { path: string }) => detail.path),
                    ['email', 'tags[0].name'],
                );
                assert.equal(error.errorDetails[0].code, zodError.issues[0].code);
                assert.equal(error.errorDetails[0].message, zodError.issues[0].message);
            });

            it('does not copy zod internals onto the Ghost error', function () {
                const error = utils.fromZodError(getError()) as unknown as Record<string, unknown>;
                assert.equal(error.issues, undefined);
                assert.equal(error._zod, undefined);
                assert.equal(error.addIssue, undefined);
            });

            it('keeps the zod stack frames behind a single-line header', function () {
                // zod v4 only captures frames for thrown errors, not safeParse results
                let zodError: unknown;
                try {
                    schema.parse({ email: 'nope', tags: [{}] });
                } catch (err) {
                    zodError = err;
                }
                assert.ok(utils.isZodError(zodError));
                const error = utils.fromZodError(zodError);
                const [header, ...frames] = error.stack!.split('\n');

                assert.equal(header, `ZodError: ${error.message}`);
                assert.ok(frames.every((line) => /^\s+at /.test(line)));
                assert.match(frames[0], /fromZodError/);
                assert.ok(frames.length > 1);
            });
        });
    }

    describe('isZodError', function () {
        it('rejects non-zod values', function () {
            assert.equal(utils.isZodError(null), false);
            assert.equal(utils.isZodError('error'), false);
            assert.equal(utils.isZodError(new Error('plain')), false);
            assert.equal(utils.isZodError({ issues: 'nope' }), false);
            assert.equal(utils.isZodError({ issues: [null] }), false);
            assert.equal(utils.isZodError({ issues: [{ code: 'x', message: 'y' }] }), false);
        });

        it('accepts zod-shaped objects', function () {
            assert.equal(utils.isZodError({ issues: [] }), true);
            assert.equal(
                utils.isZodError({ issues: [{ code: 'x', path: [], message: 'y' }] }),
                true,
            );
        });
    });

    describe('formatZodIssues', function () {
        it('formats every path segment type', function () {
            const message = utils.formatZodIssues([
                { code: 'custom', path: [], message: 'Root is invalid' },
                { code: 'custom', path: [0, 'name'], message: 'A' },
                { code: 'custom', path: ['meta', 'og-title'], message: 'B' },
                { code: 'custom', path: ['a', Symbol('s')], message: 'C' },
            ]);

            assert.equal(
                message,
                'Root is invalid; [0].name: A; meta["og-title"]: B; a[Symbol(s)]: C',
            );
        });

        it('returns an empty string for no issues', function () {
            assert.equal(utils.formatZodIssues([]), '');
        });
    });

    describe('fromZodError', function () {
        const issues = [{ code: 'custom', path: ['slug'], message: 'Slug is taken' }];

        it('supports other error classes', function () {
            const error = utils.fromZodError({ issues }, errors.IncorrectUsageError);

            assert.ok(error instanceof errors.IncorrectUsageError);
            assert.equal(error.statusCode, 400);
            assert.equal(error.level, 'critical');
            assert.equal(error.message, 'slug: Slug is taken');
            assert.equal(error.property, 'slug');
        });

        it('supports other error classes with options', function () {
            const error = utils.fromZodError({ issues }, errors.IncorrectUsageError, {
                message: 'Invalid adapter config',
                code: 'INVALID_ADAPTER_CONFIG',
            });

            assert.ok(error instanceof errors.IncorrectUsageError);
            assert.equal(error.message, 'Invalid adapter config');
            assert.equal(error.code, 'INVALID_ADAPTER_CONFIG');
            assert.equal(error.errorDetails[0].path, 'slug');
        });

        it('lets options override derived fields', function () {
            const error = utils.fromZodError(
                { issues },
                {
                    message: 'Invalid config',
                    property: 'config',
                    code: 'INVALID_CONFIG',
                    context: undefined,
                },
            );

            assert.equal(error.message, 'Invalid config');
            assert.equal(error.property, 'config');
            assert.equal(error.code, 'INVALID_CONFIG');
            assert.equal(error.errorDetails[0].path, 'slug');
        });

        it('falls back to class defaults without issues', function () {
            const error = utils.fromZodError({ issues: [] });

            assert.equal(error.message, 'The request failed validation.');
            assert.equal(error.property, null);
            assert.deepEqual(error.errorDetails, []);
        });

        it('leaves property unset for root issues', function () {
            const error = utils.fromZodError({
                issues: [{ code: 'custom', path: [], message: 'Expected object' }],
            });

            assert.equal(error.property, null);
            assert.equal(error.message, 'Expected object');
        });
    });
});
