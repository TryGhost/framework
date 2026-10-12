const ElasticSearch = require('./ElasticSearch');
const { PassThrough } = require('stream');
const split = require('split2');

// Ship a batch once it reaches this size, or once its oldest log is this old
const FLUSH_BYTES = 5 * 1000 * 1000;
const FLUSH_INTERVAL = 30 * 1000;

// Create a writable stream whose newline-delimited JSON logs are shipped in
// batched bulk requests

class ElasticSearchBunyan {
    constructor(clientConfig, index, pipeline) {
        this.client = new ElasticSearch(clientConfig);
        this.index = index;
        this.pipeline = pipeline;
        this.stream = null;
        this.done = null;

        this.action = JSON.stringify({ create: { _index: index } });
        this.lines = [];
        this.bytes = 0;
        this.timer = null;
        // Batches ship one at a time so a slow cluster can't pile up requests
        this.shipping = Promise.resolve();
    }

    getStream() {
        const stream = new PassThrough();
        const lines = stream.pipe(split());

        lines.on('data', (line) => this.add(line));

        // Resolves once the source stream has ended and every batch has
        // shipped, which is what `flush()` awaits
        this.done = new Promise((resolve) => {
            lines.on('end', resolve);
        }).then(() => {
            this.ship();
            return this.shipping;
        });

        this.stream = stream;

        return stream;
    }

    /**
     * @param {string} line Serialised log document
     */
    add(line) {
        if (line.trim() === '') {
            return;
        }

        const bytes = Buffer.byteLength(this.action) + Buffer.byteLength(line) + 2;

        if (this.bytes + bytes >= FLUSH_BYTES) {
            this.ship();
        }

        this.lines.push(this.action, line);
        this.bytes += bytes;

        if (!this.timer) {
            this.timer = setTimeout(() => this.ship(), FLUSH_INTERVAL);
            this.timer.unref();
        }
    }

    ship() {
        clearTimeout(this.timer);
        this.timer = null;

        if (this.lines.length === 0) {
            return;
        }

        const batch = this.lines;
        this.lines = [];
        this.bytes = 0;

        this.shipping = this.shipping.then(() =>
            this.client.bulkLines(batch, { pipeline: this.pipeline }),
        );
    }

    /**
     * Force any buffered documents to ship, then wait for the in-flight bulk
     * requests to resolve, so callers can guarantee logs are shipped before
     * the process exits.
     *
     * After a flush the stream is ended and can no longer be written to; this
     * is intended as a shutdown step.
     * @returns {Promise<void>}
     */
    async flush() {
        if (!this.stream) {
            return;
        }

        if (!this.stream.writableEnded) {
            this.stream.end();
        }

        await this.done;
    }
}

module.exports = ElasticSearchBunyan;
