const assert = require('assert');
const {AssertionError} = require('assert');

class EmailMockReceiver {
    #sendResponse;
    #snapshotManager;
    #snapshots = [];

    constructor({snapshotManager, sendResponse = 'Mail is disabled'}) {
        this.#snapshotManager = snapshotManager;
        this.#sendResponse = sendResponse;
    }

    /**
     * Method mocking email sending logic
     *
     * @param {EmailMessage} message - email message
     */
    async send(message) {
        // store snapshot
        this.#snapshots.push(message);

        return this.#sendResponse;
    }

    /**
     *
     * @param {Number} [index] zero-based index of the sent email
     * @returns {EmailMessage}
     */
    getSentEmail(index = 0) {
        return this.#snapshots[index];
    }

    /**
     *
     * @param {Number} count number of sent emails to expect
     * @returns {EmailMockReceiver} current instance
     */
    assertSentEmailCount(count) {
        assert.equal(this.#snapshots.length, count, 'Email count does not match');

        return this;
    }

    /**
     *
     * @param {Replacement[]} replacements replacement patterns
     * @param {Number} snapshotIndex index of snapshot to match
     * @returns {EmailMockReceiver} current instance
     */
    #matchTextSnapshot(replacements, snapshotIndex, field) {
        const error = new AssertionError({});

        let assertion = {
            properties: null,
            field: field,
            hint: `[${field} ${snapshotIndex + 1}]`,
            error
        };

        let text = this.#snapshots[snapshotIndex][field];
        if (replacements.length) {
            for (const [, {pattern, replacement}] of Object.entries(replacements)) {
                text = text.replace(pattern, replacement);
            }
        }

        const assertedObject = {};
        assertedObject[field] = text;
        this.#snapshotManager.assertSnapshot(assertedObject, assertion);

        return this;
    }

    /**
     *
     * @param {Replacement[]} [replacements] replacement patterns
     * @param {Number} [snapshotIndex] index of snapshot to match
     * @returns {EmailMockReceiver} current instance
     */
    matchHTMLSnapshot(replacements = [], snapshotIndex = 0) {
        return this.#matchTextSnapshot(replacements, snapshotIndex, 'html');
    }

    /**
     *
     * @param {Replacement[]} [replacements replacement patterns
     * @param {Number} [snapshotIndex] index of snapshot to match
     * @returns {EmailMockReceiver} current instance
     */
    matchPlaintextSnapshot(replacements = [], snapshotIndex = 0) {
        return this.#matchTextSnapshot(replacements, snapshotIndex, 'text');
    }

    /**
     *
     * @param {Object} [properties] - properties to match
     * @param {Number} [snapshotIndex] - index of snapshot to match
     * @returns {EmailMockReceiver} current instance
     */
    matchMetadataSnapshot(properties = {}, snapshotIndex = 0) {
        const error = new AssertionError({});
        let assertion = {
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

    reset() {
        this.#snapshots = [];
    }
}

module.exports = EmailMockReceiver;

/**
 * @typedef {Object} Replacement
 * @prop {String|RegExp} [pattern] - pattern to match the dynamic content
 * @prop {String} [replacement] - replacement for the matched pattern
 */

/**
 * @typedef {Object} EmailMessage
 * @prop {String} subject - email subject
 * @prop {String} html - email HTML content
 * @prop {String} to - email recipient address
 * @prop {String} [replyTo] - email reply-to address
 * @prop {String} [from] - sender email address
 * @prop {String} [text] - text version of email message
 */
