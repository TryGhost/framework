function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Return a unique identifier with the given `len`.
 *
 * @deprecated use secret.create() instead
 */
export function uid(maxLength: number): string {
    const buf: string[] = [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charLength = chars.length;
    let i: number;

    for (i = 0; i < maxLength; i = i + 1) {
        buf.push(chars[getRandomInt(0, charLength - 1)]);
    }

    return buf.join('');
}
