const ElasticSearch = require('./ElasticSearch');
const { PassThrough } = require('stream');
const split = require('split2');

// Create a writable stream which pipes data written into it, into the bulk helper

class ElasticSearchBunyan {
    constructor(clientConfig, index, pipeline) {
        this.client = new ElasticSearch(clientConfig);
        this.index = index;
        this.pipeline = pipeline;
        this.stream = null;
        this.bulk = null;
    }

    getStream() {
        const index = this.index;
        const pipeline = this.pipeline;
        const stream = new PassThrough();
        // `helpers.bulk` batches documents and only ships them on a size/time
        // threshold (30s flush interval by default) or when the source stream
        // ends. It returns a thenable that resolves once the datasource is
        // exhausted, which is what `flush()` awaits.
        this.bulk = this.client.client.helpers.bulk({
            datasource: stream.pipe(split()),
            onDocument() {
                return {
                    create: { _index: index },
                };
            },
            pipeline,
        });
        this.stream = stream;

        return stream;
    }

    /**
     * Force any buffered documents to ship, then wait for the in-flight bulk
     * request to resolve. Ending the source stream flushes the bulk helper's
     * buffer immediately instead of waiting for the flush interval, so callers
     * can guarantee logs are shipped before the process exits.
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

        try {
            await this.bulk;
        } catch {
            // Best-effort: never let a failed flush block shutdown.
        }
    }
}

module.exports = ElasticSearchBunyan;
