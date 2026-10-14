const assert = require('assert/strict');
const http = require('http');
const sinon = require('sinon');
const debugBase = require('@tryghost/debug')._base;
const sandbox = sinon.createSandbox();

const ElasticSearch = require('../lib/fetch/ElasticSearch');

const indexConfig = {
    index: 'test-index',
    pipeline: 'test-pipeline',
};

/**
 * Start a local server standing in for Elasticsearch. Each request is
 * recorded, and answered by the next queued response (default 200 `{}`).
 */
async function startServer() {
    const requests = [];
    const responses = [];

    const server = http.createServer((req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body,
            });

            const { status = 200, headers = {}, body: responseBody = {} } = responses.shift() ?? {};
            res.statusCode = status;
            res.setHeader('content-type', 'application/json');
            for (const [name, value] of Object.entries(headers)) {
                res.setHeader(name, value);
            }
            res.end(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody));
        });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    return {
        url: `http://127.0.0.1:${server.address().port}`,
        requests,
        respond(...queued) {
            responses.push(...queued);
        },
        close() {
            server.closeAllConnections();
            return new Promise((resolve) => server.close(resolve));
        },
    };
}

/**
 * Capture this package's debug output while running `fn`
 */
async function captureDebug(fn) {
    const messages = [];
    const logStub = sinon
        .stub(debugBase, 'log')
        .callsFake((...args) => messages.push(args.join(' ')));
    const previous = debugBase.disable();
    debugBase.enable('*:logging:elasticsearch');

    try {
        await fn();
    } finally {
        debugBase.enable(previous);
        logStub.restore();
    }

    return messages.join('\n');
}

function parseNdjson(body) {
    return body
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));
}

describe('ElasticSearch', function () {
    let server;
    let clientConfig;

    beforeEach(async function () {
        server = await startServer();
        clientConfig = {
            node: server.url,
            auth: {
                username: 'user',
                password: 'pass',
            },
            maxRetries: 0,
        };
    });

    afterEach(async function () {
        sandbox.restore();
        await server.close();
    });

    it('Indexes a document with Basic auth', async function () {
        const es = new ElasticSearch(clientConfig);
        await es.index({ message: 'Test data!' }, indexConfig);

        assert.equal(server.requests.length, 1);
        const [request] = server.requests;
        assert.equal(request.method, 'POST');
        assert.equal(request.url, '/test-index/_doc?pipeline=test-pipeline');
        assert.equal(
            request.headers.authorization,
            `Basic ${Buffer.from('user:pass').toString('base64')}`,
        );
        assert.equal(request.headers['content-type'], 'application/json');
        assert.deepEqual(JSON.parse(request.body), { message: 'Test data!' });
    });

    it('Uses index config as a string', async function () {
        const es = new ElasticSearch(clientConfig);
        await es.index({ message: 'Test data' }, 'test-index');

        assert.equal(server.requests[0].url, '/test-index/_doc');
    });

    it('Moves credentials in the node URL into the auth header', async function () {
        const url = new URL(server.url);
        url.username = 'url-user';
        url.password = 'p@ss';

        const es = new ElasticSearch({ node: `${url.href}`, maxRetries: 0 });
        await es.index({ message: 'Test data' }, 'test-index');

        assert.equal(server.requests[0].url, '/test-index/_doc');
        assert.equal(
            server.requests[0].headers.authorization,
            `Basic ${Buffer.from('url-user:p@ss').toString('base64')}`,
        );
    });

    it('Sends no auth header without credentials', async function () {
        const es = new ElasticSearch({ node: server.url, maxRetries: 0 });
        await es.index({ message: 'Test data' }, 'test-index');

        assert.equal(server.requests[0].headers.authorization, undefined);
    });

    it('Does not index invalid events', async function () {
        const es = new ElasticSearch(clientConfig);
        await es.index('not an object', indexConfig);

        assert.equal(server.requests.length, 0);
    });

    it('Catches index failures without throwing', async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({ status: 400, body: { error: { reason: 'mapper_parsing_exception' } } });

        await assert.doesNotReject(async () => {
            await es.index({ message: 'Test data' }, indexConfig);
        });
    });

    it('Catches non-JSON error responses without throwing', async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({ status: 502, body: 'Bad gateway' });

        await assert.doesNotReject(async () => {
            await es.index({ message: 'Test data' }, indexConfig);
        });
    });

    it("Includes Elasticsearch's error reason in debug output", async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({ status: 400, body: { error: { reason: 'mapper_parsing_exception' } } });

        const output = await captureDebug(() => es.index({ message: 'Test data' }, indexConfig));

        assert.match(output, /Failed to ship log/);
        assert.match(output, /400/);
        assert.match(output, /mapper_parsing_exception/);
    });

    it('Includes a non-JSON error body in debug output', async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({ status: 502, body: 'Bad gateway' });

        const output = await captureDebug(() =>
            es.bulk([{ index: 'metrics-test', document: { value: 1 } }]),
        );

        assert.match(output, /Failed to ship logs/);
        assert.match(output, /Bad gateway/);
    });

    it('Uses the error message alone when the error body is empty or unreadable', async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({ status: 500, body: '' });

        const emptyOutput = await captureDebug(() =>
            es.index({ message: 'Test data' }, indexConfig),
        );
        assert.match(emptyOutput, /500/);
        assert.doesNotMatch(emptyOutput, /\(\)/);

        server.respond({ status: 500, body: 'consumed' });
        sandbox.stub(Response.prototype, 'text').rejects(new Error('body used'));

        const unreadableOutput = await captureDebug(() =>
            es.index({ message: 'Test data' }, indexConfig),
        );
        assert.match(unreadableOutput, /500/);
        assert.doesNotMatch(unreadableOutput, /consumed/);
    });

    it('Catches network failures without throwing', async function () {
        const es = new ElasticSearch({ node: 'http://127.0.0.1:1', maxRetries: 0 });

        await assert.doesNotReject(async () => {
            await es.index({ message: 'Test data' }, indexConfig);
        });
    });

    it('Retries retryable responses', async function () {
        const es = new ElasticSearch({ ...clientConfig, maxRetries: 1 });
        // Retry-After keeps the backoff out of the test's runtime
        server.respond({ status: 503, headers: { 'retry-after': '0' } }, { status: 201 });

        await es.index({ message: 'Test data' }, indexConfig);

        assert.equal(server.requests.length, 2);
        assert.deepEqual(JSON.parse(server.requests[1].body), { message: 'Test data' });
    });

    it('Times out slow requests', async function () {
        const slow = http.createServer(() => {});
        await new Promise((resolve) => slow.listen(0, '127.0.0.1', resolve));

        try {
            const es = new ElasticSearch({
                node: `http://127.0.0.1:${slow.address().port}`,
                requestTimeout: 50,
                maxRetries: 0,
            });

            await assert.doesNotReject(async () => {
                await es.index({ message: 'Test data' }, indexConfig);
            });
        } finally {
            slow.closeAllConnections();
            await new Promise((resolve) => slow.close(resolve));
        }
    });

    it('Ships a batch of events in a single bulk request', async function () {
        const es = new ElasticSearch(clientConfig);

        await es.bulk([
            { index: 'metrics-cache-hit', document: { value: 1 } },
            { index: 'metrics-cache-miss', document: { value: 2 } },
        ]);

        assert.equal(server.requests.length, 1);
        const [request] = server.requests;
        assert.equal(request.url, '/_bulk');
        assert.equal(request.headers['content-type'], 'application/x-ndjson');
        assert.ok(request.body.endsWith('\n'));
        assert.deepEqual(parseNdjson(request.body), [
            { create: { _index: 'metrics-cache-hit' } },
            { value: 1 },
            { create: { _index: 'metrics-cache-miss' } },
            { value: 2 },
        ]);
    });

    it('Does not send a bulk request for an empty or invalid batch', async function () {
        const es = new ElasticSearch(clientConfig);

        await es.bulk([]);
        await es.bulk(undefined);
        await es.bulk([
            { index: 'metrics-test', document: 'not an object' },
            { index: 'metrics-test', document: null },
        ]);

        assert.equal(server.requests.length, 0);
    });

    it('Skips invalid documents but ships the rest of the batch', async function () {
        const es = new ElasticSearch(clientConfig);

        await es.bulk([
            { index: 'metrics-test', document: 'not an object' },
            { index: 'metrics-test', document: { value: 1 } },
        ]);

        assert.equal(server.requests.length, 1);
        assert.deepEqual(parseNdjson(server.requests[0].body), [
            { create: { _index: 'metrics-test' } },
            { value: 1 },
        ]);
    });

    it('Splits bulk requests by serialized size and skips oversized documents', async function () {
        const es = new ElasticSearch(clientConfig);
        const originalByteLength = Buffer.byteLength;

        // Only inflate single serialised documents, not the request body that
        // fetch measures when sending
        sandbox.stub(Buffer, 'byteLength').callsFake((value) => {
            if (typeof value !== 'string' || value.includes('\n')) {
                return originalByteLength(value);
            }

            if (value.includes('"size":"large"')) {
                return 60 * 1024 * 1024;
            }

            if (value.includes('"size":"oversized"')) {
                return 100 * 1024 * 1024;
            }

            return originalByteLength(value);
        });

        await es.bulk([
            { index: 'metrics-test', document: { size: 'large', value: 1 } },
            { index: 'metrics-test', document: { size: 'large', value: 2 } },
            { index: 'metrics-test', document: { size: 'oversized' } },
            { index: 'metrics-test', document: { value: 3 } },
        ]);

        assert.equal(server.requests.length, 2);
        assert.deepEqual(
            parseNdjson(server.requests[0].body).filter((_, index) => index % 2 === 1),
            [{ size: 'large', value: 1 }],
        );
        assert.deepEqual(
            parseNdjson(server.requests[1].body).filter((_, index) => index % 2 === 1),
            [{ size: 'large', value: 2 }, { value: 3 }],
        );
    });

    it('Skips an unserializable bulk document without dropping its neighbours', async function () {
        const es = new ElasticSearch(clientConfig);
        const circular = {};
        circular.self = circular;

        await es.bulk([
            { index: 'metrics-test', document: { value: 1 } },
            { index: 'metrics-test', document: circular },
            { index: 'metrics-test', document: { value: 2 } },
        ]);

        assert.equal(server.requests.length, 1);
        assert.deepEqual(
            parseNdjson(server.requests[0].body).filter((_, index) => index % 2 === 1),
            [{ value: 1 }, { value: 2 }],
        );
    });

    it('Catches bulk failures without throwing', async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({ status: 400, body: { error: { reason: 'boom' } } });

        await assert.doesNotReject(async () => {
            await es.bulk([{ index: 'metrics-test', document: { value: 1 } }]);
        });
    });

    it('Does not throw on partial bulk failures', async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({
            body: {
                errors: true,
                items: [
                    { create: { error: { reason: 'mapper_parsing_exception' } } },
                    { create: {} },
                ],
            },
        });

        await assert.doesNotReject(async () => {
            await es.bulk([
                { index: 'metrics-test', document: { value: 'a' } },
                { index: 'metrics-test', document: { value: 1 } },
            ]);
        });
    });

    it('Handles an empty response body', async function () {
        const es = new ElasticSearch(clientConfig);
        server.respond({ body: '' });

        await assert.doesNotReject(async () => {
            await es.bulk([{ index: 'metrics-test', document: { value: 1 } }]);
        });
    });
});
