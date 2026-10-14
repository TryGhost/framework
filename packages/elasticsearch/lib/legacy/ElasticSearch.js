const { Client } = require('@elastic/elasticsearch');
const debug = require('@tryghost/debug')('logging:elasticsearch');

// Elasticsearch defaults http.max_content_length to 100 MB. Keep every bulk
// request strictly below that limit, including the newline after each NDJSON line.
const MAX_BULK_REQUEST_BYTES = 100 * 1024 * 1024;

// Singleton client - multiple children made from it for a single connection pool
let client;

class ElasticSearch {
    constructor(clientConfig) {
        if (!client) {
            client = new Client(clientConfig);
        }

        this.client = client.child();
    }

    /**
     * Write an event to ElasticSearch
     * @param {Object} data Event data to index
     * @param {Object | string} index Index - either string representing the index or a property bag containing the index and other parameters
     */
    async index(data, index) {
        if (typeof data !== 'object') {
            debug('ElasticSearch transport requires log data to be an object');
            return;
        }

        if (typeof index === 'string') {
            index = { index };
        }

        try {
            await this.client.index({
                body: data,
                ...index,
            });
        } catch (error) {
            debug('Failed to ship log', error.message);
        }
    }

    /**
     * Write a batch of events to ElasticSearch in a single bulk request
     *
     * Uses the `create` action rather than `index` so the same call works
     * against data streams as well as regular indices; without an `_id` the
     * two are equivalent for append-only writes.
     * @param {Array<{index: string, document: Object}>} operations Events to index, each with its target index
     * @returns {Promise<void>}
     */
    async bulk(operations) {
        if (!Array.isArray(operations) || operations.length === 0) {
            return;
        }

        const body = [];
        let bodyBytes = 0;

        const ship = async () => {
            if (body.length === 0) {
                return;
            }

            try {
                const result = await this.client.bulk({ operations: body.splice(0) });

                // Partial failures don't reject, so they'd otherwise be invisible
                if (result?.errors) {
                    const failed = result.items.filter((item) => item.create?.error);
                    debug(
                        `Failed to ship ${failed.length} of ${result.items.length} logs`,
                        failed[0]?.create?.error?.reason,
                    );
                }
            } catch (error) {
                debug('Failed to ship logs', error.message);
            }

            bodyBytes = 0;
        };

        for (const operation of operations) {
            if (typeof operation?.document !== 'object' || operation.document === null) {
                debug('ElasticSearch transport requires log data to be an object');
                continue;
            }

            const action = { create: { _index: operation.index } };
            let operationBytes;

            try {
                operationBytes =
                    Buffer.byteLength(JSON.stringify(action)) +
                    Buffer.byteLength(JSON.stringify(operation.document)) +
                    2;
            } catch (error) {
                debug('Failed to serialize log for bulk shipping', error.message);
                continue;
            }

            if (operationBytes >= MAX_BULK_REQUEST_BYTES) {
                debug('Log is too large for Elasticsearch bulk shipping');
                continue;
            }

            if (bodyBytes + operationBytes >= MAX_BULK_REQUEST_BYTES) {
                await ship();
            }

            body.push(action, operation.document);
            bodyBytes += operationBytes;
        }

        await ship();
    }
}

module.exports = ElasticSearch;
