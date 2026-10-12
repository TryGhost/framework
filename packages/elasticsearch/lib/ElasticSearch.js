const { withHeaders, withRetry, withTimeout } = require('fetch-extras');
const debug = require('@tryghost/debug')('logging:elasticsearch');

// Elasticsearch defaults http.max_content_length to 100 MB. Keep every bulk
// request strictly below that limit, including the newline after each NDJSON line.
const MAX_BULK_REQUEST_BYTES = 100 * 1024 * 1024;

const DEFAULT_REQUEST_TIMEOUT = 30 * 1000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Normalise the configured node into a base URL and Basic auth credentials.
 * `fetch` refuses URLs that carry credentials, so any embedded in the node URL
 * are moved into the auth header instead.
 * @param {string} node
 * @param {{username?: string, password?: string}} [auth]
 */
function parseNode(node, auth) {
    const url = new URL(node);
    let username = auth?.username;
    let password = auth?.password;

    if (url.username || url.password) {
        username ??= decodeURIComponent(url.username);
        password ??= decodeURIComponent(url.password);
        url.username = '';
        url.password = '';
    }

    return {
        baseUrl: url.href.replace(/\/+$/, ''),
        username,
        password,
    };
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
        const { baseUrl, username, password } = parseNode(clientConfig.node, clientConfig.auth);

        this.baseUrl = baseUrl;

        const headers = {};
        if (username || password) {
            headers.authorization = `Basic ${Buffer.from(`${username ?? ''}:${password ?? ''}`).toString('base64')}`;
        }

        // Every Elasticsearch write is a POST, which fetch-extras does not
        // retry by default. Bodies are always strings so they can be replayed.
        this.fetch = withHeaders(headers)(
            withRetry({
                retries: clientConfig.maxRetries ?? DEFAULT_MAX_RETRIES,
                methods: ['POST'],
            })(withTimeout(clientConfig.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT)(fetch)),
        );
    }

    /**
     * @param {string} path Path relative to the node URL
     * @param {object} params Query string parameters
     * @param {string} body Request body
     * @param {string} contentType
     * @returns {Promise<any>} Parsed JSON response
     */
    async request(path, params, body, contentType) {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                query.set(key, String(value));
            }
        }

        const search = query.size > 0 ? `?${query}` : '';
        const response = await this.fetch(`${this.baseUrl}/${path}${search}`, {
            method: 'POST',
            headers: { 'content-type': contentType },
            body,
        });

        const text = await response.text();

        if (!response.ok) {
            let reason = text;
            try {
                reason = JSON.parse(text).error?.reason ?? text;
            } catch {
                // Not JSON, use the raw body
            }

            throw new Error(`Elasticsearch responded with ${response.status}: ${reason}`);
        }

        return text ? JSON.parse(text) : {};
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
            await this.request(
                `${encodeURIComponent(indexName)}/_doc`,
                params,
                JSON.stringify(data),
                'application/json',
            );
        } catch (error) {
            debug('Failed to ship log', error.message);
        }
    }

    /**
     * Ship pre-serialised NDJSON lines in a single bulk request
     * @param {string[]} lines Action and document lines, without trailing newlines
     * @param {{pipeline?: string}} [params] Bulk request query parameters
     * @returns {Promise<void>}
     */
    async bulkLines(lines, params = {}) {
        if (lines.length === 0) {
            return;
        }

        try {
            const result = await this.request(
                '_bulk',
                params,
                `${lines.join('\n')}\n`,
                'application/x-ndjson',
            );

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
            const batch = lines;
            lines = [];
            bodyBytes = 0;
            await this.bulkLines(batch);
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
