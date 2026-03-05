import assert from 'node:assert';

// Original code uses AssertionError (typo in Node.js) which is the same as AssertionError
const AssertionError = assert.AssertionError;

export interface Replacement {
    pattern: string | RegExp;
    replacement: string;
}

export interface EmailMessage {
    subject?: string;
    html?: string;
    to?: string;
    replyTo?: string;
    from?: string;
    text?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
}

interface SnapshotAssertion {
    properties: Record<string, unknown> | null;
    field: string;
    hint: string;
    error: Error;
}

interface SnapshotManager {
    assertSnapshot(obj: Record<string, unknown>, assertion: SnapshotAssertion): void;
}

interface EmailMockReceiverOptions {
    snapshotManager: SnapshotManager;
    sendResponse?: string;
}

class EmailMockReceiver {
    #sendResponse: string;
    #snapshotManager: SnapshotManager;
    #snapshots: EmailMessage[] = [];

    constructor({snapshotManager, sendResponse = 'Mail is disabled'}: EmailMockReceiverOptions) {
        this.#snapshotManager = snapshotManager;
        this.#sendResponse = sendResponse;
    }

    async send(message: EmailMessage): Promise<string> {
        // store snapshot
        this.#snapshots.push(message);

        return this.#sendResponse;
    }

    getSentEmail(index: number = 0): EmailMessage | undefined {
        return this.#snapshots[index];
    }

    assertSentEmailCount(count: number): EmailMockReceiver {
        assert.equal(this.#snapshots.length, count, 'Email count does not match');

        return this;
    }

    #matchTextSnapshot(replacements: Replacement[], snapshotIndex: number, field: string): EmailMockReceiver {
        const error = new AssertionError({});

        const assertion: SnapshotAssertion = {
            properties: null,
            field: field,
            hint: `[${field} ${snapshotIndex + 1}]`,
            error
        };

        let text = this.#snapshots[snapshotIndex][field] as string;
        if (replacements.length) {
            for (const [, {pattern, replacement}] of Object.entries(replacements)) {
                text = text.replace(pattern, replacement);
            }
        }

        const assertedObject: Record<string, unknown> = {};
        assertedObject[field] = text;
        this.#snapshotManager.assertSnapshot(assertedObject, assertion);

        return this;
    }

    matchHTMLSnapshot(replacements: Replacement[] = [], snapshotIndex: number = 0): EmailMockReceiver {
        return this.#matchTextSnapshot(replacements, snapshotIndex, 'html');
    }

    matchPlaintextSnapshot(replacements: Replacement[] = [], snapshotIndex: number = 0): EmailMockReceiver {
        return this.#matchTextSnapshot(replacements, snapshotIndex, 'text');
    }

    matchMetadataSnapshot(properties: Record<string, unknown> = {}, snapshotIndex: number = 0): EmailMockReceiver {
        const error = new AssertionError({});
        const assertion: SnapshotAssertion = {
            properties: properties,
            field: 'metadata',
            hint: `[metadata ${snapshotIndex + 1}]`,
            error
        };

        const metadata = Object.assign({}, this.#snapshots[snapshotIndex]);
        delete metadata.html;
        delete metadata.text;

        this.#snapshotManager.assertSnapshot({
            metadata
        }, assertion);

        return this;
    }

    reset(): void {
        this.#snapshots = [];
    }
}

export default EmailMockReceiver;
