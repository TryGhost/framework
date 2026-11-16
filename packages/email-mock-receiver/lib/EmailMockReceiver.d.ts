/**
 * Records sent emails in place of a real mailer, with snapshot assertions.
 */
declare class EmailMockReceiver {
    constructor(options: EmailMockReceiver.EmailMockReceiverOptions);

    /** Record a message and resolve to the configured `sendResponse`. */
    send(message: EmailMockReceiver.EmailMessage): Promise<unknown>;

    /** Get a sent email by zero-based index (default `0`). */
    getSentEmail(index?: number): EmailMockReceiver.EmailMessage;

    assertSentEmailCount(count: number): this;

    matchHTMLSnapshot(replacements?: EmailMockReceiver.Replacement[], snapshotIndex?: number): this;

    matchPlaintextSnapshot(
        replacements?: EmailMockReceiver.Replacement[],
        snapshotIndex?: number,
    ): this;

    /** Snapshot every field except `html` and `text`. */
    matchMetadataSnapshot(properties?: object, snapshotIndex?: number): this;

    /** Forget all recorded emails. */
    reset(): void;
}

declare namespace EmailMockReceiver {
    /**
     * Anything that can assert a snapshot, such as `snapshotManager` from
     * `@tryghost/jest-snapshot`.
     */
    interface SnapshotManager {
        assertSnapshot(response: object, assertion: object): void;
    }

    interface Replacement {
        /** Pattern matching the dynamic content. */
        pattern: string | RegExp;
        /** Replacement for the matched pattern. */
        replacement: string;
    }

    interface EmailMessage {
        subject: string;
        html: string;
        to: string;
        replyTo?: string;
        from?: string;
        text?: string;
        [key: string]: unknown;
    }

    interface EmailMockReceiverOptions {
        snapshotManager: SnapshotManager;
        /** Value returned by `send()`. Defaults to `'Mail is disabled'`. */
        sendResponse?: unknown;
    }
}

export = EmailMockReceiver;
