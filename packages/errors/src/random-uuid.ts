/**
 * Isomorphic UUID v4 generator.
 *
 * Uses the global Web Crypto API rather than importing Node's `crypto` module,
 * so this package can be bundled for the browser (e.g. Ghost's Ember admin)
 * without pulling in Node built-ins.
 *
 * - Prefers `crypto.randomUUID()`, available in Node 19+ and in browsers, but
 *   only in secure contexts (HTTPS/localhost).
 * - Falls back to building a v4 UUID from `crypto.getRandomValues()`, which is
 *   available even in insecure contexts.
 */

const globalCrypto: typeof globalThis.crypto | undefined = globalThis.crypto;

const hex: string[] = [];
for (let i = 0; i < 256; i += 1) {
    hex.push((i + 0x100).toString(16).slice(1));
}

function uuidFromGetRandomValues(): string {
    const bytes = new Uint8Array(16);
    globalCrypto!.getRandomValues(bytes);

    // Set the version (4) and variant (RFC 4122) bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return (
        hex[bytes[0]] +
        hex[bytes[1]] +
        hex[bytes[2]] +
        hex[bytes[3]] +
        '-' +
        hex[bytes[4]] +
        hex[bytes[5]] +
        '-' +
        hex[bytes[6]] +
        hex[bytes[7]] +
        '-' +
        hex[bytes[8]] +
        hex[bytes[9]] +
        '-' +
        hex[bytes[10]] +
        hex[bytes[11]] +
        hex[bytes[12]] +
        hex[bytes[13]] +
        hex[bytes[14]] +
        hex[bytes[15]]
    );
}

export function randomUUID(): string {
    if (globalCrypto?.randomUUID) {
        return globalCrypto.randomUUID();
    }

    if (globalCrypto?.getRandomValues) {
        return uuidFromGetRandomValues();
    }

    throw new Error('No secure random number generator available to generate a UUID');
}
