const { AssertionError } = require('assert');
const { URL } = require('url');
const nockModule = require('nock');
const nock = nockModule.default || nockModule;
const pWaitFor = require('p-wait-for').default;
class WebhookMockReceiver {
    constructor({ snapshotManager }) {
        this.snapshotManager = snapshotManager;
        // Bumped by mock() and reset() so reply callbacks from a superseded
        // mock can't record into the current one
        this._mockGeneration = 0;
        this.recordRequest = this.recordRequest.bind(this);
    }

    recordRequest(body, options) {
        this.body = { body };
        this.headers = { headers: options.headers };
    }

    async receivedRequest() {
        // @NOTE: figure out a better waiting mechanism here, don't allow it to hang forever
        // Nock marks the interceptor done when the request matches, before the
        // async reply callback records it, so wait for both
        await pWaitFor(() => this._receiver.isDone() && this.headers !== undefined);
    }

    /**
     *
     * @param {String} url endpoint URL to be mocked
     * @returns WebhookMockReceiver
     */
    mock(url) {
        const parsedURL = new URL(url);
        const mockGeneration = ++this._mockGeneration;
        const recordRequest = (...args) => {
            if (mockGeneration === this._mockGeneration) {
                this.recordRequest(...args);
            }
        };
        this.body = undefined;
        this.headers = undefined;

        this._receiver = nock(parsedURL.origin)
            .post(parsedURL.pathname)
            .reply(
                200,
                async function (...args) {
                    if (args.length === 1) {
                        // Nock 15 passes a Fetch Request; older versions pass URI and body.
                        const request = args[0];
                        const text = await request.text();
                        let body = text;
                        if (
                            text &&
                            request.headers.get('content-type')?.includes('application/json')
                        ) {
                            try {
                                body = JSON.parse(text);
                            } catch {
                                // Preserve non-JSON payloads, as Nock's body matcher does.
                            }
                        }
                        recordRequest(body, { headers: Object.fromEntries(request.headers) });
                    } else {
                        recordRequest(args[1], this.req);
                    }
                    return { status: 'OK' };
                },
                { 'Content-Length': '15' },
            );

        return this;
    }

    reset() {
        nock.cleanAll();
        this._mockGeneration += 1;
        this._receiver = undefined;
        this.body = undefined;
        this.headers = undefined;
    }

    matchBodySnapshot(properties = {}) {
        const error = new AssertionError({});
        let assertion = {
            properties: properties,
            field: 'body',
            type: 'body',
            error,
        };

        this.snapshotManager.assertSnapshot(this.body, assertion);

        return this;
    }

    matchHeaderSnapshot(properties = {}) {
        const error = new AssertionError({});
        let assertion = {
            properties: properties,
            field: 'headers',
            type: 'header',
            error,
        };

        this.snapshotManager.assertSnapshot(this.headers, assertion);

        return this;
    }
}

module.exports = WebhookMockReceiver;
