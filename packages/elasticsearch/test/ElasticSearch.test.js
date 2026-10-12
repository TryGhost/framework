const assert = require('assert/strict');
const http = require('http');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const ElasticSearch = require('../index');
const ElasticSearchBunyan = require('../lib/ElasticSearchBunyan');

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

describe('ElasticSearch Bunyan', function () {
    let server;
    let clientConfig;

    beforeEach(async function () {
        server = await startServer();
        clientConfig = { node: server.url, maxRetries: 0 };
    });

    afterEach(async function () {
        sandbox.restore();
        await server.close();
    });

    it('flush() ships buffered logs in one bulk request', async function () {
        const es = new ElasticSearchBunyan(clientConfig, indexConfig.index, indexConfig.pipeline);

        const stream = es.getStream();
        stream.write(`${JSON.stringify({ message: 'one' })}\n`);
        stream.write(`${JSON.stringify({ message: 'two' })}\n`);

        await es.flush();

        assert.equal(stream.writableEnded, true);
        assert.equal(server.requests.length, 1);
        assert.equal(server.requests[0].url, '/_bulk?pipeline=test-pipeline');
        assert.deepEqual(parseNdjson(server.requests[0].body), [
            { create: { _index: 'test-index' } },
            { message: 'one' },
            { create: { _index: 'test-index' } },
            { message: 'two' },
        ]);
    });

    it('Joins logs split across writes and ignores blank lines', async function () {
        const es = new ElasticSearchBunyan(clientConfig, indexConfig.index);

        const stream = es.getStream();
        stream.write('{"message":');
        stream.write('"one"}\n\n');

        await es.flush();

        assert.equal(server.requests[0].url, '/_bulk');
        assert.deepEqual(parseNdjson(server.requests[0].body), [
            { create: { _index: 'test-index' } },
            { message: 'one' },
        ]);
    });

    it('Ships a batch once the flush interval passes', async function () {
        const clock = sandbox.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const es = new ElasticSearchBunyan(clientConfig, indexConfig.index);
        const bulkSpy = sandbox.spy(es.client, 'bulkLines');

        const stream = es.getStream();
        stream.write(`${JSON.stringify({ message: 'one' })}\n`);
        await new Promise(setImmediate);

        assert.equal(bulkSpy.callCount, 0);

        clock.tick(30 * 1000);
        clock.restore();
        await es.shipping;

        assert.equal(bulkSpy.callCount, 1);
        assert.equal(server.requests.length, 1);
    });

    it('Ships a batch once it reaches the size limit', async function () {
        const es = new ElasticSearchBunyan(clientConfig, indexConfig.index);
        const bulkSpy = sandbox.spy(es.client, 'bulkLines');
        const large = 'x'.repeat(3 * 1000 * 1000);

        const stream = es.getStream();
        stream.write(`${JSON.stringify({ message: large })}\n`);
        stream.write(`${JSON.stringify({ message: large })}\n`);
        await new Promise(setImmediate);

        assert.equal(bulkSpy.callCount, 1);

        await es.flush();

        assert.equal(bulkSpy.callCount, 2);
        assert.equal(server.requests.length, 2);
    });

    it('flush() can be called more than once without re-ending the stream', async function () {
        const es = new ElasticSearchBunyan(clientConfig, indexConfig.index);

        const stream = es.getStream();
        const endSpy = sandbox.spy(stream, 'end');

        await es.flush();
        await es.flush();

        assert.equal(stream.writableEnded, true);
        assert.equal(endSpy.callCount, 1);
        assert.equal(server.requests.length, 0);
    });

    it('flush() is a no-op when no stream was created', async function () {
        const es = new ElasticSearchBunyan(clientConfig, indexConfig.index);

        await assert.doesNotReject(async () => {
            await es.flush();
        });
    });

    it('flush() swallows a failed bulk request', async function () {
        const es = new ElasticSearchBunyan(clientConfig, indexConfig.index);
        server.respond({ status: 500, body: { error: { reason: 'boom' } } });

        const stream = es.getStream();
        stream.write(`${JSON.stringify({ message: 'one' })}\n`);

        await assert.doesNotReject(async () => {
            await es.flush();
        });
    });
});
