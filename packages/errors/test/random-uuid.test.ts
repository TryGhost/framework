import assert from 'assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { randomUUID } from '../src/random-uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUUID', function () {
    afterEach(function () {
        // Remove any own-property shadows added by a test, revealing the real
        // Crypto.prototype methods again.
        delete (globalThis.crypto as Record<string, unknown>).randomUUID;
        delete (globalThis.crypto as Record<string, unknown>).getRandomValues;
        vi.restoreAllMocks();
    });

    it('returns a valid v4 UUID', function () {
        assert.match(randomUUID(), UUID_V4);
    });

    it('returns unique values', function () {
        assert.notEqual(randomUUID(), randomUUID());
    });

    it('uses crypto.randomUUID when available', function () {
        const spy = vi.spyOn(globalThis.crypto, 'randomUUID');
        randomUUID();
        assert.equal(spy.mock.calls.length, 1);
    });

    it('falls back to getRandomValues in insecure contexts', function () {
        // Simulate an insecure browser context: randomUUID is unavailable,
        // but getRandomValues still works.
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
            value: undefined,
            configurable: true,
        });

        const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
        const id = randomUUID();

        assert.ok(spy.mock.calls.length >= 1);
        assert.match(id, UUID_V4);
    });

    it('throws when no random source is available', function () {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
            value: undefined,
            configurable: true,
        });
        Object.defineProperty(globalThis.crypto, 'getRandomValues', {
            value: undefined,
            configurable: true,
        });

        assert.throws(() => randomUUID(), /No secure random number generator/);
    });
});
