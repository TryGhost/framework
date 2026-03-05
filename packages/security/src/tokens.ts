import crypto from 'node:crypto';

interface GenerateFromContentOptions {
    content: string;
}

interface GenerateFromEmailOptions {
    expires: number;
    email: string;
    secret: string;
}

interface ResetTokenGenerateHashOptions {
    expires: number | string;
    email: string;
    dbHash: string;
    password: string;
}

interface ResetTokenExtractOptions {
    token: string;
}

interface ResetTokenExtractResult {
    expires: number;
    email: string;
}

interface ResetTokenCompareOptions {
    token: string;
    dbHash: string;
    password: string;
}

interface ResetTokenCompareResult {
    correct: boolean;
    reason?: string;
}

export function generateFromContent(options?: GenerateFromContentOptions): string {
    options = options || {} as GenerateFromContentOptions;

    const hash = crypto.createHash('sha256');
    const content = options.content;

    let text = '';

    hash.update(content);

    text += [content, hash.digest('base64')].join('|');
    return Buffer.from(text).toString('base64');
}

export function generateFromEmail(options?: GenerateFromEmailOptions): string {
    options = options || {} as GenerateFromEmailOptions;

    const hash = crypto.createHash('sha256');
    const expires = options.expires;
    const email = options.email;
    const secret = options.secret;

    let text = '';

    hash.update(String(expires));
    hash.update(email.toLocaleLowerCase());
    hash.update(String(secret));

    text += [expires, email, hash.digest('base64')].join('|');
    return Buffer.from(text).toString('base64');
}

export const resetToken = {
    generateHash(options?: ResetTokenGenerateHashOptions): string {
        options = options || {} as ResetTokenGenerateHashOptions;

        const hash = crypto.createHash('sha256');
        const expires = options.expires;
        const email = options.email;
        const dbHash = options.dbHash;
        const password = options.password;
        let text = '';

        hash.update(String(expires));
        hash.update(email.toLocaleLowerCase());
        hash.update(password);
        hash.update(String(dbHash));

        text += [expires, email, hash.digest('base64')].join('|');
        return Buffer.from(text).toString('base64');
    },
    extract(options?: ResetTokenExtractOptions): ResetTokenExtractResult | false {
        options = options || {} as ResetTokenExtractOptions;

        const token = options.token;
        const tokenText = Buffer.from(token, 'base64').toString('ascii');
        let parts: string[];
        let expires: number;
        let email: string;

        parts = tokenText.split('|');

        // Check if invalid structure
        if (!parts || parts.length !== 3) {
            return false;
        }

        expires = parseInt(parts[0], 10);
        email = parts[1];

        return {
            expires: expires,
            email: email
        };
    },
    compare(options?: ResetTokenCompareOptions): ResetTokenCompareResult {
        options = options || {} as ResetTokenCompareOptions;

        const tokenToCompare = options.token;
        const parts = resetToken.extract({token: tokenToCompare});
        const dbHash = options.dbHash;
        const password = options.password;
        let generatedToken: string;
        let diff = 0;
        let i: number;

        if (parts === false || isNaN(parts.expires)) {
            return {
                correct: false,
                reason: 'invalid_expiry'
            };
        }

        // Check if token is expired to prevent replay attacks
        if (parts.expires < Date.now()) {
            return {
                correct: false,
                reason: 'expired'
            };
        }

        generatedToken = resetToken.generateHash({
            email: parts.email,
            expires: parts.expires,
            dbHash: dbHash,
            password: password
        });

        if (tokenToCompare.length !== generatedToken.length) {
            diff = 1;
        }

        for (i = tokenToCompare.length - 1; i >= 0; i = i - 1) {
            diff |= tokenToCompare.charCodeAt(i) ^ generatedToken.charCodeAt(i);
        }

        const result: ResetTokenCompareResult = {
            correct: (diff === 0)
        };

        if (!result.correct) {
            result.reason = 'invalid';
        }

        return result;
    }
};
