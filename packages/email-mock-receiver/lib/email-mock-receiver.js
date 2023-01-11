const {AssertionError} = require('assert');

class EmailMockReceiver {
    #sendResponse;
    #snapshotManager;
    #snapshot = null;

    constructor({snapshotManager, sendResponse = 'Mail is disabled'}) {
        this.#snapshotManager = snapshotManager;
        this.#sendResponse = sendResponse;
    }

    /**
     * Method mocking email sending logic
     *
     * @param {Object} message
     * @param {string} message.subject - email subject
     * @param {string} message.html - email content
     * @param {string} message.to - email recipient address
     * @param {string} [message.replyTo]
     * @param {string} [message.from] - sender email address
     * @param {string} [message.text] - text version of this message
     */
    async send({subject, html, to, replyTo, from, text}) {
        if (this.#snapshot) {
            return this.#sendResponse;
        }

        // store snapshot
        this.#snapshot = {
            subject,
            html,
            to,
            from,
            replyTo,
            text
        };

        return this.#sendResponse;
    }

    matchHTMLSnapshot() {
        const error = new AssertionError({});
        let assertion = {
            properties: null,
            field: 'html',
            error
        };

        this.#snapshotManager.assertSnapshot({
            html: this.#snapshot.html
        }, assertion);

        return this;
    }

    reset() {
        this.#snapshot = null;
    }
}

module.exports = EmailMockReceiver;
