const {
    pipeline,
    withBaseUrl,
    withHeaders,
    withHttpError,
    withJsonResponse,
    withRetry,
    withTimeout,
} = require('fetch-extras');
const debug = require('@tryghost/debug')('logging:elasticsearch');

// Elasticsearch defaults http.max_content_length to 100 MB. Keep every bulk
// request strictly below that limit, including the newline after each NDJSON line.
const MAX_BULK_REQUEST_BYTES = 100 * 1024 * 1024;

const DEFAULT_REQUEST_TIMEOUT = 30 * 1000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Split the configured node into a credential-free base URL and Basic auth
 * header. `fetch` refuses URLs that carry credentials, so any embedded in the
 * node URL are moved into the header instead.
 * @param {string} node
 * @param {{username?: string, password?: string}} [auth]
 * @returns {{baseUrl: URL, headers: Record<string, string>}}
 */
function parseNode(node, auth) {
    const baseUrl = new URL(node);
    const username = auth?.username ?? decodeURIComponent(baseUrl.username);
    const password = auth?.password ?? decodeURIComponent(baseUrl.password);

    baseUrl.username = '';
    baseUrl.password = '';

    const headers = {};
    if (username || password) {
        headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    return { baseUrl, headers };
}

/**
 * Describe a failed request, including Elasticsearch's reason from the
 * response body when there is one
 * @param {Error & {response?: Response}} error
 * @returns {Promise<string>}
 */
async function describeError(error) {
    if (!error.response) {
        return error.message;
    }

    try {
        const text = await error.response.text();
        let reason = text;
        try {
            reason = JSON.parse(text).error?.reason ?? text;
        } catch {
            // Not JSON, use the raw body
        }
        return reason ? `${error.message} (${reason})` : error.message;
    } catch {
        return error.message;
    }
}

class ElasticSearch {
    /**
     * @param {object} clientConfig
     * @param {string} clientConfig.node Elasticsearch URL
     * @param {{username?: string, password?: string}} [clientConfig.auth] Basic auth credentials
     * @param {number} [clientConfig.requestTimeout] Per-attempt request timeout in milliseconds
     * @param {number} [clientConfig.maxRetries] Retries for network errors and retryable status codes
     */
    constructor(clientConfig) {
        const { baseUrl, headers } = parseNode(clientConfig.node, clientConfig.auth);

        this.fetch = pipeline(
            fetch,
            withTimeout(clientConfig.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT),
            withBaseUrl(baseUrl),
            withHeaders(headers),
            // Every Elasticsearch write is a POST, which isn't retried by
            // default. Bodies are always strings so they can be replayed.
            withRetry({
                retries: clientConfig.maxRetries ?? DEFAULT_MAX_RETRIES,
                methods: ['POST'],
            }),
            withHttpError(),
            withJsonResponse(),
        );
    }

    /**
     * @param {string} path Path relative to the node URL
     * @param {Record<string, string | undefined>} params Query string parameters; unset values are left out
     * @param {string} body Request body
     * @param {string} contentType
     * @returns {Promise<any>} Parsed JSON response
     */
    post(path, params, body, contentType) {
        const query = new URLSearchParams(
            Object.entries(params).filter(([, value]) => value != null),
        );

        return this.fetch(query.size > 0 ? `${path}?${query}` : path, {
            method: 'POST',
            headers: { 'content-type': contentType },
            body,
        });
    }

    /**
     * Write an event to ElasticSearch
     * @param {Object} data Event data to index
     * @param {Object | string} index Index - either string representing the index or a property bag containing the index and other query parameters
     */
    async index(data, index) {
        if (typeof data !== 'object') {
            debug('ElasticSearch transport requires log data to be an object');
            return;
        }

        if (typeof index === 'string') {
            index = { index };
        }

        const { index: indexName, ...params } = index;

        try {
            await this.post(
                `${encodeURIComponent(indexName)}/_doc`,
                params,
                JSON.stringify(data),
                'application/json',
            );
        } catch (error) {
            debug('Failed to ship log', await describeError(error));
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

        let lines = [];
        let bodyBytes = 0;

        const ship = async () => {
            if (lines.length === 0) {
                return;
            }

            const body = `${lines.join('\n')}\n`;
            lines = [];
            bodyBytes = 0;

            try {
                const result = await this.post('_bulk', {}, body, 'application/x-ndjson');

                // Partial failures don't reject, so they'd otherwise be invisible
                if (result?.errors) {
                    const failed = result.items.filter((item) => item.create?.error);
                    debug(
                        `Failed to ship ${failed.length} of ${result.items.length} logs`,
                        failed[0]?.create?.error?.reason,
                    );
                }
            } catch (error) {
                debug('Failed to ship logs', await describeError(error));
            }
        };

        for (const operation of operations) {
            if (typeof operation?.document !== 'object' || operation.document === null) {
                debug('ElasticSearch transport requires log data to be an object');
                continue;
            }

            let action;
            let document;

            try {
                action = JSON.stringify({ create: { _index: operation.index } });
                document = JSON.stringify(operation.document);
            } catch (error) {
                debug('Failed to serialize log for bulk shipping', error.message);
                continue;
            }

            const operationBytes = Buffer.byteLength(action) + Buffer.byteLength(document) + 2;

            if (operationBytes >= MAX_BULK_REQUEST_BYTES) {
                debug('Log is too large for Elasticsearch bulk shipping');
                continue;
            }

            if (bodyBytes + operationBytes >= MAX_BULK_REQUEST_BYTES) {
                await ship();
            }

            lines.push(action, document);
            bodyBytes += operationBytes;
        }

        await ship();
    }
}

module.exports = ElasticSearch;
