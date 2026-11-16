/**
 * Intercepts a webhook POST with nock and records its body and headers for
 * snapshot assertions.
 */
declare class WebhookMockReceiver {
    snapshotManager: WebhookMockReceiver.SnapshotManager;
    /** Recorded request body, wrapped as `{body}`. */
    body: { body: unknown } | undefined;
    /** Recorded request headers, wrapped as `{headers}`. */
    headers: { headers: Record<string, unknown> } | undefined;

    constructor(options: { snapshotManager: WebhookMockReceiver.SnapshotManager });

    /**
     * Record a received request's body and headers. Bound to the instance.
     * Its arguments do not match a nock reply callback's `(uri, requestBody)`,
     * so adapt them rather than passing this method to `.reply()` directly;
     * `mock()` already does this.
     */
    recordRequest(body: unknown, options: { headers: Record<string, unknown> }): void;

    /** Intercept POST requests to `url`. Clears anything previously recorded. */
    mock(url: string): this;

    /** Resolve once the mocked endpoint has received and recorded a request. */
    receivedRequest(): Promise<void>;

    /** Remove all nock interceptors and recorded data. */
    reset(): void;

    matchBodySnapshot(properties?: object): this;

    matchHeaderSnapshot(properties?: object): this;
}

declare namespace WebhookMockReceiver {
    /**
     * Anything that can assert a snapshot, such as `snapshotManager` from
     * `@tryghost/jest-snapshot`.
     */
    interface SnapshotManager {
        assertSnapshot(response: object | undefined, assertion: object): void;
    }
}

export = WebhookMockReceiver;
