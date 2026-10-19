import bcrypt from 'bcryptjs';

let HASH_ROUNDS = 10;

if (process.env.NODE_ENV?.startsWith('testing')) {
    HASH_ROUNDS = 1;
}

export async function hash(plainPassword: string): Promise<string> {
    const salt = await bcrypt.genSalt(HASH_ROUNDS);
    return bcrypt.hash(plainPassword, salt);
}

export function compare(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
}
