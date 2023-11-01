const {AssertionError} = require('assert');
const {URL} = require('url');
const nock = require('nock');
const pWaitFor = require('p-wait-for');

class WebhookMockReceiver {
    constructor({snapshotManager}) {
        this.body;
        this.headers;
        this._receiver;
        this.snapshotManager = snapshotManager;
        this.recordRequest = this.recordRequest.bind(this);
    }

    recordRequest(body, options) {
        this.body = {body};
        this.headers = {headers: options.headers};
    }

    async receivedRequest() {
        // @NOTE: figure out a better waiting mechanism here, don't allow it to hang forever
        await pWaitFor(() => this._receiver.isDone());
    }

    /**
     *
     * @param {String} url endpoint URL to be mocked
     * @returns WebhookMockReceiver
     */
    mock(url) {
        const parsedURL = new URL(url);
        const recordRequest = this.recordRequest;

        this._receiver = nock(parsedURL.origin)
            .post(parsedURL.pathname, function (body) {
                recordRequest(body, this);
                // let the nock continue with the response
                return true;
            })
            .reply(200, {status: 'OK'});

        return this;
    }

    reset() {
        nock.cleanAll();
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
            error
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
            error
        };

        this.snapshotManager.assertSnapshot(this.headers, assertion);

        return this;
    }
}

module.exports = WebhookMockReceiver;
