import { createHash, type BinaryLike } from 'node:crypto';

type ContentTokenOptions = { content: BinaryLike };
type EmailTokenOptions = { expires: number | string; email: string; secret: string };
type ResetTokenOptions = {
    expires: number | string;
    email: string;
    dbHash: string;
    passwordHash: BinaryLike;
};
type ExtractedToken = { expires: number; email: string };
type TokenComparison = {
    correct: boolean;
    reason?: 'invalid_expiry' | 'expired' | 'invalid';
};

export function generateFromContent(options: ContentTokenOptions): string {
    const hash = createHash('sha256');
    const content = options?.content;

    let text = '';

    hash.update(content);

    text += [content, hash.digest('base64')].join('|');
    return Buffer.from(text).toString('base64');
}

export function generateFromEmail(options: EmailTokenOptions): string {
    const hash = createHash('sha256');
    const expires = options?.expires;
    const email = options?.email;
    const secret = options?.secret;

    let text = '';

    hash.update(String(expires));
    hash.update(email.toLocaleLowerCase());
    hash.update(String(secret));

    text += [expires, email, hash.digest('base64')].join('|');
    return Buffer.from(text).toString('base64');
}

export const resetToken = {
    generateHash: function generateHash(options: ResetTokenOptions): string {
        const hash = createHash('sha256');
        const expires = options?.expires;
        const email = options?.email;
        const dbHash = options?.dbHash;
        const passwordHash = options?.passwordHash;
        let text = '';

        hash.update(String(expires));
        hash.update(email.toLocaleLowerCase());
        // Reset tokens are not password storage; the current password hash is
        // mixed in only to invalidate old tokens after password changes.
        hash.update(passwordHash);
        hash.update(String(dbHash));

        text += [expires, email, hash.digest('base64')].join('|');
        return Buffer.from(text).toString('base64');
    },
    extract: function extract(options: { token: string }): ExtractedToken | false {
        const token = options?.token;
        const tokenText = Buffer.from(token, 'base64').toString('ascii');
        let parts;
        let expires;
        let email;

        parts = tokenText.split('|');

        // Check if invalid structure
        if (!parts || parts.length !== 3) {
            return false;
        }

        expires = parseInt(parts[0], 10);
        email = parts[1];

        return {
            expires: expires,
            email: email,
        };
    },
    compare: function compare(options: {
        token: string;
        dbHash: string;
        passwordHash: BinaryLike;
    }): TokenComparison {
        const tokenToCompare = options?.token;
        const parts = resetToken.extract({ token: tokenToCompare });
        const dbHash = options?.dbHash;
        const passwordHash = options?.passwordHash;
        let generatedToken;
        let diff = 0;
        let i;

        if (!parts || isNaN(parts.expires)) {
            return {
                correct: false,
                reason: 'invalid_expiry',
            };
        }

        // Check if token is expired to prevent replay attacks
        if (parts.expires < Date.now()) {
            return {
                correct: false,
                reason: 'expired',
            };
        }

        generatedToken = resetToken.generateHash({
            email: parts.email,
            expires: parts.expires,
            dbHash: dbHash,
            passwordHash: passwordHash,
        });

        if (tokenToCompare.length !== generatedToken.length) {
            diff = 1;
        }

        for (i = tokenToCompare.length - 1; i >= 0; i = i - 1) {
            diff |= tokenToCompare.charCodeAt(i) ^ generatedToken.charCodeAt(i);
        }

        const result: TokenComparison = {
            correct: diff === 0,
        };

        if (!result.correct) {
            result.reason = 'invalid';
        }

        return result;
    },
};
