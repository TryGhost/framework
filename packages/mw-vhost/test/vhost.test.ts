import assert from 'assert/strict';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import vhost from '../src/index.js';

interface MockRequest {
    headers: { host: string | undefined };
    hostname?: string;
    vhost?: unknown;
}

interface MockResponse {
    statusCode: number;
    end(body?: string): void;
}

interface DispatchResult {
    statusCode: number;
    body: string;
}

type VhostMiddleware = (req: MockRequest, res: MockResponse, next: (err?: unknown) => void) => void;

describe('vhost(hostname, server)', function () {
    it('should route by Host', async function () {
        const vhosts: VhostMiddleware[] = [];

        vhosts.push(vhost('tobi.com', tobi) as unknown as VhostMiddleware);
        vhosts.push(vhost('loki.com', loki) as unknown as VhostMiddleware);

        const app = createServer(vhosts);

        function tobi(_req: MockRequest, res: MockResponse): void {
            res.end('tobi');
        }
        function loki(_req: MockRequest, res: MockResponse): void {
            res.end('loki');
        }

        const response = await dispatch(app, {host: 'tobi.com'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'tobi');
    });

    it('should route by `req.hostname` (express v4)', async function () {
        const vhosts: VhostMiddleware[] = [];

        vhosts.push(vhost('anotherhost.com', anotherhost) as unknown as VhostMiddleware);
        vhosts.push(vhost('loki.com', loki) as unknown as VhostMiddleware);

        const app = createServer(vhosts, undefined, function (req: MockRequest) {
            // simulate express setting req.hostname based on x-forwarded-host
            req.hostname = 'anotherhost.com';
        });

        function anotherhost(_req: MockRequest, res: MockResponse): void {
            res.end('anotherhost');
        }
        function loki(_req: MockRequest, res: MockResponse): void {
            res.end('loki');
        }

        const response = await dispatch(app, {host: 'loki.com'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'anotherhost');
    });

    it('should ignore port in Host', async function () {
        const app = createServer('tobi.com', function (_req: MockRequest, res: MockResponse) {
            res.end('tobi');
        });

        const response = await dispatch(app, {host: 'tobi.com:8080'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'tobi');
    });

    it('should support IPv6 literal in Host', async function () {
        const app = createServer('[::1]', function (_req: MockRequest, res: MockResponse) {
            res.end('loopback');
        });

        const response = await dispatch(app, {host: '[::1]:8080'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'loopback');
    });

    it('should 404 unless matched', async function () {
        const vhosts: VhostMiddleware[] = [];

        vhosts.push(vhost('tobi.com', tobi) as unknown as VhostMiddleware);
        vhosts.push(vhost('loki.com', loki) as unknown as VhostMiddleware);

        const app = createServer(vhosts);

        function tobi(_req: MockRequest, res: MockResponse): void {
            res.end('tobi');
        }
        function loki(_req: MockRequest, res: MockResponse): void {
            res.end('loki');
        }

        const response = await dispatch(app, {host: 'ferrets.com'});
        assert.equal(response.statusCode, 404);
        assert.equal(response.body, 'no vhost for "ferrets.com"');
    });

    it('should 404 without Host header', async function () {
        const vhosts: VhostMiddleware[] = [];

        vhosts.push(vhost('tobi.com', tobi) as unknown as VhostMiddleware);
        vhosts.push(vhost('loki.com', loki) as unknown as VhostMiddleware);

        const app = createServer(vhosts);

        function tobi(_req: MockRequest, res: MockResponse): void {
            res.end('tobi');
        }
        function loki(_req: MockRequest, res: MockResponse): void {
            res.end('loki');
        }

        const response = await dispatch(app, {host: undefined});
        assert.equal(response.statusCode, 404);
        assert.equal(response.body, 'no vhost for "undefined"');
    });

    describe('arguments', function () {
        describe('hostname', function () {
            it('should be required', function () {
                assert.throws(vhost.bind(null, '' as unknown as string, (() => {}) as unknown as RequestHandler), /hostname.*required/);
            });

            it('should accept string', function () {
                assert.doesNotThrow(vhost.bind(null, 'loki.com', (() => {}) as unknown as RequestHandler));
            });

            it('should accept RegExp', function () {
                assert.doesNotThrow(vhost.bind(null, /loki\.com/, (() => {}) as unknown as RequestHandler));
            });
        });

        describe('handle', function () {
            it('should be required', function () {
                assert.throws(vhost.bind(null, 'loki.com', undefined as unknown as RequestHandler), /handle.*required/);
            });

            it('should accept function', function () {
                assert.doesNotThrow(vhost.bind(null, 'loki.com', (() => {}) as unknown as RequestHandler));
            });

            it('should reject plain object', function () {
                assert.throws(vhost.bind(null, 'loki.com', {} as unknown as RequestHandler), /handle.*function/);
            });
        });
    });

    describe('with string hostname', function () {
        it('should support wildcards', async function () {
            const app = createServer('*.ferrets.com', function (_req: MockRequest, res: MockResponse) {
                res.end('wildcard!');
            });

            const response = await dispatch(app, {host: 'loki.ferrets.com'});
            assert.equal(response.statusCode, 200);
            assert.equal(response.body, 'wildcard!');
        });

        it('should restrict wildcards to single part', async function () {
            const app = createServer('*.ferrets.com', function (_req: MockRequest, res: MockResponse) {
                res.end('wildcard!');
            });

            const response = await dispatch(app, {host: 'foo.loki.ferrets.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "foo.loki.ferrets.com"');
        });

        it('should treat dot as a dot', async function () {
            const app = createServer('a.b.com', function (_req: MockRequest, res: MockResponse) {
                res.end('tobi');
            });

            const response = await dispatch(app, {host: 'aXb.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "aXb.com"');
        });

        it('should match entire string', async function () {
            const app = createServer('.com', function (_req: MockRequest, res: MockResponse) {
                res.end('commercial');
            });

            const response = await dispatch(app, {host: 'foo.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "foo.com"');
        });

        it('should populate req.vhost', async function () {
            const app = createServer('user-*.*.com', function (req: MockRequest, res: MockResponse) {
                const vhostData = (req as MockRequest & { vhost: Record<string, unknown> }).vhost;
                const keys = Object.keys(vhostData).sort();
                const arr = keys.map(function (k: string) {
                    return [k, (vhostData as Record<string, unknown>)[k]];
                });
                res.end(JSON.stringify(arr));
            });

            const response = await dispatch(app, {host: 'user-bob.foo.com:8080'});
            assert.equal(response.statusCode, 200);
            assert.equal(response.body, '[["0","bob"],["1","foo"],["host","user-bob.foo.com:8080"],["hostname","user-bob.foo.com"],["length",2]]');
        });
    });

    describe('with RegExp hostname', function () {
        it('should match using RegExp', async function () {
            const app = createServer(/[tl]o[bk]i\.com/, function (_req: MockRequest, res: MockResponse) {
                res.end('tobi');
            });

            const response = await dispatch(app, {host: 'toki.com'});
            assert.equal(response.statusCode, 200);
            assert.equal(response.body, 'tobi');
        });

        it('should match entire hostname', async function () {
            const vhosts: VhostMiddleware[] = [];

            vhosts.push(vhost(/\.tobi$/, tobi) as unknown as VhostMiddleware);
            vhosts.push(vhost(/^loki\./, loki) as unknown as VhostMiddleware);

            const app = createServer(vhosts);

            function tobi(_req: MockRequest, res: MockResponse): void {
                res.end('tobi');
            }
            function loki(_req: MockRequest, res: MockResponse): void {
                res.end('loki');
            }

            const response = await dispatch(app, {host: 'loki.tobi.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "loki.tobi.com"');
        });

        it('should populate req.vhost', async function () {
            const app = createServer(/user-(bob|joe)\.([^.]+)\.com/, function (req: MockRequest, res: MockResponse) {
                const vhostData = (req as MockRequest & { vhost: Record<string, unknown> }).vhost;
                const keys = Object.keys(vhostData).sort();
                const arr = keys.map(function (k: string) {
                    return [k, (vhostData as Record<string, unknown>)[k]];
                });
                res.end(JSON.stringify(arr));
            });

            const response = await dispatch(app, {host: 'user-bob.foo.com:8080'});
            assert.equal(response.statusCode, 200);
            assert.equal(response.body, '[["0","bob"],["1","foo"],["host","user-bob.foo.com:8080"],["hostname","user-bob.foo.com"],["length",2]]');
        });
    });
});

type ServerHandler = (req: MockRequest, res: MockResponse) => void;

function createServer(
    hostname: string | RegExp | VhostMiddleware[],
    server?: ServerHandler,
    pretest?: (req: MockRequest, res: MockResponse) => void
): ServerHandler {
    const vhosts: VhostMiddleware[] = !Array.isArray(hostname)
        ? [vhost(hostname, server as unknown as (req: Request, res: Response, next: NextFunction) => void) as unknown as VhostMiddleware]
        : hostname;

    return function onRequest(req: MockRequest, res: MockResponse): void {
        // This allows you to perform changes to the request/response
        // objects before our assertions
        if (pretest) {
            pretest(req, res);
        }

        let index = 0;
        function next(err?: unknown): void {
            const foundVhost = vhosts[index];
            index = index + 1;

            if (!foundVhost || err) {
                const error = err as { status?: number; message?: string };
                res.statusCode = err ? (error.status || 500) : 404;
                res.end(err ? error.message : `no vhost for "${req.headers.host}"`);
                return;
            }

            foundVhost(req, res, next);
        }

        next();
    };
}

function dispatch(app: ServerHandler, {host}: {host: string | undefined}): Promise<DispatchResult> {
    return new Promise((resolve, reject) => {
        const req: MockRequest = {
            headers: {host}
        };

        const res: MockResponse = {
            statusCode: 200,
            end(body?: string) {
                resolve({
                    statusCode: this.statusCode,
                    body: body || ''
                });
            }
        };

        try {
            app(req, res);
        } catch (err) {
            reject(err);
        }
    });
}
