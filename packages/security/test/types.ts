import type { BinaryLike } from 'node:crypto';
import security = require('../');
import * as namespace from '../';
import { expectTypeOf } from 'vitest';

expectTypeOf(security.url.encodeBase64('a+b/c==')).toEqualTypeOf<string>();
expectTypeOf(namespace.url.decodeBase64('a-b_c')).toEqualTypeOf<string>();
expectTypeOf(security.password.hash('password')).toEqualTypeOf<Promise<string>>();
expectTypeOf(security.password.compare('password', 'hash')).toEqualTypeOf<Promise<boolean>>();
expectTypeOf(security.secret.create()).toEqualTypeOf<string>();
expectTypeOf(security.secret.create(13)).toEqualTypeOf<string>();
expectTypeOf(security.identifier.uid(24)).toEqualTypeOf<string>();
expectTypeOf(security.string.safe()).toEqualTypeOf<string>();
expectTypeOf(security.string.safe(null)).toEqualTypeOf<string>();
expectTypeOf(
    security.tokens.generateFromContent({ content: Buffer.from('content') }),
).toEqualTypeOf<string>();
expectTypeOf(
    security.tokens.generateFromEmail({
        email: 'test@example.com',
        expires: 1700000000000,
        secret: 'secret',
    }),
).toEqualTypeOf<string>();

const extracted = security.tokens.resetToken.extract({ token: 'token' });
if (extracted !== false) {
    expectTypeOf(extracted.email).toEqualTypeOf<string>();
    expectTypeOf(extracted.expires).toEqualTypeOf<number>();
}
const comparison = security.tokens.resetToken.compare({
    token: 'token',
    dbHash: 'hash',
    passwordHash: 'stored-hash',
});
expectTypeOf(comparison.correct).toEqualTypeOf<boolean>();
expectTypeOf(comparison.reason).toEqualTypeOf<
    'invalid_expiry' | 'expired' | 'invalid' | undefined
>();
expectTypeOf(security.url.encodeBase64).parameter(0).toEqualTypeOf<string>();
expectTypeOf(security.identifier.uid).parameter(0).toEqualTypeOf<number>();
expectTypeOf(security.tokens.resetToken.generateHash).parameter(0).toEqualTypeOf<{
    expires: number | string;
    email: string;
    dbHash: string;
    passwordHash: BinaryLike;
}>();
expectTypeOf(security.tokens.resetToken.compare).parameter(0).toEqualTypeOf<{
    token: string;
    dbHash: string;
    passwordHash: BinaryLike;
}>();
expectTypeOf(
    security.tokens.resetToken.generateHash({
        expires: 4102444800000,
        email: 'test@example.com',
        dbHash: 'site-secret',
        passwordHash: Buffer.from('stored-hash'),
    }),
).toEqualTypeOf<string>();
