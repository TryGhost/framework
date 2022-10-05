const {AssertionError} = require('assert');
const {URL} = require('url');
const nock = require('nock');
const pWaitFor = require('p-wait-for');

class WebhookMockReceiver {
    constructor({snapshotManager}) {
        this.bodyResponse;
        this._receiver;
        this.snapshotManager = snapshotManager;
        this.recordBodyResponse = this.recordBodyResponse.bind(this);
    }

    recordBodyResponse(body) {
        this.bodyResponse = {body};

        // let the nock continue with the response
        return true;
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

        this.receiver = nock(parsedURL.origin)
            .post(parsedURL.pathname, this.recordBodyResponse)
            .reply(200, {status: 'OK'});

        return this;
    }

    reset() {
        nock.cleanAll();
        this.receiver = undefined;
        this.bodyResponse = undefined;
    }

    matchBodySnapshot(properties = {}) {
        const error = new AssertionError({});
        let assertion = {
            properties: properties,
            field: 'body',
            type: 'body',
            error
        };

        this.snapshotManager.assertSnapshot(this.bodyResponse, assertion);

        return this;
    }
}

module.exports = WebhookMockReceiver;
