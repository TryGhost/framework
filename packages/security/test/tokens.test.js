const assert = require('assert/strict');
const crypto = require('crypto');
const security = require('../');

describe('Utils: tokens', function () {
    it('covers default options branches for token helpers', function () {
        assert.throws(() => security.tokens.generateFromContent());
        assert.throws(() => security.tokens.generateFromEmail());
        assert.throws(() => security.tokens.resetToken.generateHash());
        assert.throws(() => security.tokens.resetToken.extract());
        assert.throws(() => security.tokens.resetToken.compare());
    });

    it('generateFromContent creates encoded content+hash token', function () {
        const token = security.tokens.generateFromContent({content: 'abc'});
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const parts = decoded.split('|');

        assert.equal(parts.length, 2);
        assert.equal(parts[0], 'abc');
        assert.equal(parts[1].length > 0, true);
    });

    it('generateFromEmail creates encoded expires+email+hash token', function () {
        const expires = Date.now() + 60 * 1000;
        const token = security.tokens.generateFromEmail({
            expires,
            email: 'test@example.com',
            secret: 's3cr3t'
        });
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const parts = decoded.split('|');

        assert.equal(parts.length, 3);
        assert.equal(parts[0], String(expires));
        assert.equal(parts[1], 'test@example.com');
        assert.equal(parts[2].length > 0, true);
    });

    it('generate', function () {
        const expires = Date.now() + 60 * 1000;
        const dbHash = crypto.randomUUID();
        let token;

        token = security.tokens.resetToken.generateHash({
            email: 'test1@ghost.org',
            expires: expires,
            password: 'password',
            dbHash: dbHash
        });

        assert.notEqual(token, undefined);
        assert.equal(token.length > 0, true);
    });

    it('compare: success', function () {
        const expires = Date.now() + 60 * 1000;
        const dbHash = crypto.randomUUID();
        let token;
        let tokenIsCorrect;

        token = security.tokens.resetToken.generateHash({
            email: 'test1@ghost.org',
            expires: expires,
            password: '12345678',
            dbHash: dbHash
        });

        tokenIsCorrect = security.tokens.resetToken.compare({
            token: token,
            dbHash: dbHash,
            password: '12345678'
        });

        assert.equal(tokenIsCorrect.correct, true);
        assert.equal(tokenIsCorrect.reason, undefined);
    });

    it('compare: error from invalid password', function () {
        const expires = Date.now() + 60 * 1000;
        const dbHash = crypto.randomUUID();
        let token;
        let tokenIsCorrect;

        token = security.tokens.resetToken.generateHash({
            email: 'test1@ghost.org',
            expires: expires,
            password: '12345678',
            dbHash: dbHash
        });

        tokenIsCorrect = security.tokens.resetToken.compare({
            token: token,
            dbHash: dbHash,
            password: '123456'
        });

        assert.equal(tokenIsCorrect.correct, false);
        assert.equal(tokenIsCorrect.reason, 'invalid');
    });

    it('compare: error from invalid expires parameter', function () {
        const invalidDate = 'not a date';
        const dbHash = crypto.randomUUID();
        let token;
        let tokenIsCorrect;

        token = security.tokens.resetToken.generateHash({
            email: 'test1@ghost.org',
            expires: invalidDate,
            password: '12345678',
            dbHash: dbHash
        });

        tokenIsCorrect = security.tokens.resetToken.compare({
            token: token,
            dbHash: dbHash,
            password: '123456'
        });

        assert.equal(tokenIsCorrect.correct, false);
        assert.equal(tokenIsCorrect.reason, 'invalid_expiry');
    });

    it('compare: error from expired token', function () {
        const dateInThePast = Date.now() - 60 * 1000;
        const dbHash = crypto.randomUUID();
        let token;
        let tokenIsCorrect;

        token = security.tokens.resetToken.generateHash({
            email: 'test1@ghost.org',
            expires: dateInThePast,
            password: '12345678',
            dbHash: dbHash
        });

        tokenIsCorrect = security.tokens.resetToken.compare({
            token: token,
            dbHash: dbHash,
            password: '123456'
        });

        assert.equal(tokenIsCorrect.correct, false);
        assert.equal(tokenIsCorrect.reason, 'expired');
    });

    it('extract', function () {
        const expires = Date.now() + 60 * 1000;
        const dbHash = crypto.randomUUID();
        let token;
        let parts;
        const email = 'test1@ghost.org';

        token = security.tokens.resetToken.generateHash({
            email: email,
            expires: expires,
            password: '12345678',
            dbHash: dbHash
        });

        parts = security.tokens.resetToken.extract({
            token: token
        });

        assert.equal(parts.email, email);
        assert.equal(parts.expires, expires);
        assert.equal(parts.password, undefined);
        assert.equal(parts.dbHash, undefined);
    });

    it('extract - hashed password', function () {
        const expires = Date.now() + 60 * 1000;
        const dbHash = crypto.randomUUID();
        let token;
        let parts;
        const email = 'test3@ghost.org';

        token = security.tokens.resetToken.generateHash({
            email: email,
            expires: expires,
            password: '$2a$10$t5dY1uRRdjvqfNlXhae3uuc0nuhi.Rd7/K/9JaHHwSkLm6UUa3NsW',
            dbHash: dbHash
        });

        parts = security.tokens.resetToken.extract({
            token: token
        });

        assert.equal(parts.email, email);
        assert.equal(parts.expires, expires);
        assert.equal(parts.password, undefined);
        assert.equal(parts.dbHash, undefined);
    });

    it('extract returns false for invalid token structure', function () {
        const invalidToken = Buffer.from('one|two').toString('base64');
        const result = security.tokens.resetToken.extract({token: invalidToken});

        assert.equal(result, false);
    });

    it('can validate an URI encoded reset token', function () {
        const expires = Date.now() + 60 * 1000;
        const email = 'test1@ghost.org';
        const dbHash = crypto.randomUUID();
        let token;
        let tokenIsCorrect;
        let parts;

        token = security.tokens.resetToken.generateHash({
            email: email,
            expires: expires,
            password: '12345678',
            dbHash: dbHash
        });

        token = security.url.encodeBase64(token);
        token = encodeURIComponent(token);
        token = decodeURIComponent(token);
        token = security.url.decodeBase64(token);

        parts = security.tokens.resetToken.extract({
            token: token
        });

        assert.equal(parts.email, email);
        assert.equal(parts.expires, expires);

        tokenIsCorrect = security.tokens.resetToken.compare({
            token: token,
            dbHash: dbHash,
            password: '12345678'
        });

        assert.equal(tokenIsCorrect.correct, true);
    });

    it('compare treats mismatched token length as invalid', function () {
        const expires = Date.now() + 60 * 1000;
        const dbHash = crypto.randomUUID();

        const token = security.tokens.resetToken.generateHash({
            email: 'test4@ghost.org',
            expires,
            password: '12345678',
            dbHash
        });

        const mismatchedLengthToken = `${token}A`;

        const tokenIsCorrect = security.tokens.resetToken.compare({
            token: mismatchedLengthToken,
            dbHash,
            password: '12345678'
        });

        assert.equal(tokenIsCorrect.correct, false);
        assert.equal(tokenIsCorrect.reason, 'invalid');
    });
});
