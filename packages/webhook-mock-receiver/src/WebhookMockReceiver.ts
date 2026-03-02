import {AssertionError} from 'assert';
import nock from 'nock';

interface SnapshotManager {
    assertSnapshot(data: unknown, assertion: SnapshotAssertion): void;
}

interface SnapshotAssertion {
    properties: Record<string, unknown>;
    field: string;
    type: string;
    error: AssertionError;
}

interface WebhookMockReceiverOptions {
    snapshotManager: SnapshotManager;
}

interface RequestOptions {
    headers: Record<string, string>;
}

class WebhookMockReceiver {
    body: {body: unknown} | undefined;
    headers: {headers: Record<string, string>} | undefined;
    _receiver: nock.Scope | undefined;
    snapshotManager: SnapshotManager;
    recordRequest: (body: unknown, options: RequestOptions) => void;

    constructor({snapshotManager}: WebhookMockReceiverOptions) {
        this.body = undefined;
        this.headers = undefined;
        this._receiver = undefined;
        this.snapshotManager = snapshotManager;
        this.recordRequest = this._recordRequest.bind(this);
    }

    _recordRequest(body: unknown, options: RequestOptions): void {
        this.body = {body};
        this.headers = {headers: options.headers};
    }

    async receivedRequest(): Promise<void> {
        // @NOTE: figure out a better waiting mechanism here, don't allow it to hang forever
        const {default: pWaitFor} = await import('p-wait-for');
        await pWaitFor(() => (this._receiver as nock.Scope).isDone());
    }

    mock(url: string): this {
        const parsedURL = new URL(url);
        const recordRequest = this.recordRequest;

        this._receiver = nock(parsedURL.origin)
            .post(parsedURL.pathname, function (body: nock.Body) {
                recordRequest(body, this as unknown as RequestOptions);
                // let the nock continue with the response
                return true;
            })
            .reply(200, {status: 'OK'});

        return this;
    }

    reset(): void {
        nock.cleanAll();
        this._receiver = undefined;
        this.body = undefined;
        this.headers = undefined;
    }

    matchBodySnapshot(properties: Record<string, unknown> = {}): this {
        const error = new AssertionError({});
        const assertion: SnapshotAssertion = {
            properties: properties,
            field: 'body',
            type: 'body',
            error
        };

        this.snapshotManager.assertSnapshot(this.body, assertion);

        return this;
    }

    matchHeaderSnapshot(properties: Record<string, unknown> = {}): this {
        const error = new AssertionError({});
        const assertion: SnapshotAssertion = {
            properties: properties,
            field: 'headers',
            type: 'header',
            error
        };

        this.snapshotManager.assertSnapshot(this.headers, assertion);

        return this;
    }
}

export default WebhookMockReceiver;
