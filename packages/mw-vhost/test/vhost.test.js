const assert = require('assert/strict');
const vhost = require('..');

describe('vhost(hostname, server)', function () {
    it('should route by Host', async function () {
        const vhosts = [];

        vhosts.push(vhost('tobi.com', tobi));
        vhosts.push(vhost('loki.com', loki));

        const app = createServer(vhosts);

        function tobi(req, res) {
            res.end('tobi');
        }
        function loki(req, res) {
            res.end('loki');
        }

        const response = await dispatch(app, {host: 'tobi.com'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'tobi');
    });

    it('should route by `req.hostname` (express v4)', async function () {
        const vhosts = [];

        vhosts.push(vhost('anotherhost.com', anotherhost));
        vhosts.push(vhost('loki.com', loki));

        const app = createServer(vhosts, null, function (req) {
            // simulate express setting req.hostname based on x-forwarded-host
            req.hostname = 'anotherhost.com';
        });

        function anotherhost(req, res) {
            res.end('anotherhost');
        }
        function loki(req, res) {
            res.end('loki');
        }

        const response = await dispatch(app, {host: 'loki.com'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'anotherhost');
    });

    it('should ignore port in Host', async function () {
        const app = createServer('tobi.com', function (req, res) {
            res.end('tobi');
        });

        const response = await dispatch(app, {host: 'tobi.com:8080'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'tobi');
    });

    it('should support IPv6 literal in Host', async function () {
        const app = createServer('[::1]', function (req, res) {
            res.end('loopback');
        });

        const response = await dispatch(app, {host: '[::1]:8080'});
        assert.equal(response.statusCode, 200);
        assert.equal(response.body, 'loopback');
    });

    it('should 404 unless matched', async function () {
        const vhosts = [];

        vhosts.push(vhost('tobi.com', tobi));
        vhosts.push(vhost('loki.com', loki));

        const app = createServer(vhosts);

        function tobi(req, res) {
            res.end('tobi');
        }
        function loki(req, res) {
            res.end('loki');
        }

        const response = await dispatch(app, {host: 'ferrets.com'});
        assert.equal(response.statusCode, 404);
        assert.equal(response.body, 'no vhost for "ferrets.com"');
    });

    it('should 404 without Host header', async function () {
        const vhosts = [];

        vhosts.push(vhost('tobi.com', tobi));
        vhosts.push(vhost('loki.com', loki));

        const app = createServer(vhosts);

        function tobi(req, res) {
            res.end('tobi');
        }
        function loki(req, res) {
            res.end('loki');
        }

        const response = await dispatch(app, {host: undefined});
        assert.equal(response.statusCode, 404);
        assert.equal(response.body, 'no vhost for "undefined"');
    });

    describe('arguments', function () {
        describe('hostname', function () {
            it('should be required', function () {
                assert.throws(vhost.bind(), /hostname.*required/);
            });

            it('should accept string', function () {
                assert.doesNotThrow(vhost.bind(null, 'loki.com', function () {}));
            });

            it('should accept RegExp', function () {
                assert.doesNotThrow(vhost.bind(null, /loki\.com/, function () {}));
            });
        });

        describe('handle', function () {
            it('should be required', function () {
                assert.throws(vhost.bind(null, 'loki.com'), /handle.*required/);
            });

            it('should accept function', function () {
                assert.doesNotThrow(vhost.bind(null, 'loki.com', function () {}));
            });

            it('should reject plain object', function () {
                assert.throws(vhost.bind(null, 'loki.com', {}), /handle.*function/);
            });
        });
    });

    describe('with string hostname', function () {
        it('should support wildcards', async function () {
            const app = createServer('*.ferrets.com', function (req, res) {
                res.end('wildcard!');
            });

            const response = await dispatch(app, {host: 'loki.ferrets.com'});
            assert.equal(response.statusCode, 200);
            assert.equal(response.body, 'wildcard!');
        });

        it('should restrict wildcards to single part', async function () {
            const app = createServer('*.ferrets.com', function (req, res) {
                res.end('wildcard!');
            });

            const response = await dispatch(app, {host: 'foo.loki.ferrets.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "foo.loki.ferrets.com"');
        });

        it('should treat dot as a dot', async function () {
            const app = createServer('a.b.com', function (req, res) {
                res.end('tobi');
            });

            const response = await dispatch(app, {host: 'aXb.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "aXb.com"');
        });

        it('should match entire string', async function () {
            const app = createServer('.com', function (req, res) {
                res.end('commercial');
            });

            const response = await dispatch(app, {host: 'foo.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "foo.com"');
        });

        it('should populate req.vhost', async function () {
            const app = createServer('user-*.*.com', function (req, res) {
                const keys = Object.keys(req.vhost).sort();
                const arr = keys.map(function (k) {
                    return [k, req.vhost[k]];
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
            const app = createServer(/[tl]o[bk]i\.com/, function (req, res) {
                res.end('tobi');
            });

            const response = await dispatch(app, {host: 'toki.com'});
            assert.equal(response.statusCode, 200);
            assert.equal(response.body, 'tobi');
        });

        it('should match entire hostname', async function () {
            const vhosts = [];

            vhosts.push(vhost(/\.tobi$/, tobi));
            vhosts.push(vhost(/^loki\./, loki));

            const app = createServer(vhosts);

            function tobi(req, res) {
                res.end('tobi');
            }
            function loki(req, res) {
                res.end('loki');
            }

            const response = await dispatch(app, {host: 'loki.tobi.com'});
            assert.equal(response.statusCode, 404);
            assert.equal(response.body, 'no vhost for "loki.tobi.com"');
        });

        it('should populate req.vhost', async function () {
            const app = createServer(/user-(bob|joe)\.([^.]+)\.com/, function (req, res) {
                const keys = Object.keys(req.vhost).sort();
                const arr = keys.map(function (k) {
                    return [k, req.vhost[k]];
                });
                res.end(JSON.stringify(arr));
            });

            const response = await dispatch(app, {host: 'user-bob.foo.com:8080'});
            assert.equal(response.statusCode, 200);
            assert.equal(response.body, '[["0","bob"],["1","foo"],["host","user-bob.foo.com:8080"],["hostname","user-bob.foo.com"],["length",2]]');
        });
    });
});

function createServer(hostname, server, pretest) {
    const vhosts = !Array.isArray(hostname)
        ? [vhost(hostname, server)]
        : hostname;

    return function onRequest(req, res) {
        // This allows you to perform changes to the request/response
        // objects before our assertions
        if (pretest) {
            pretest(req, res);
        }

        let index = 0;
        function next(err) {
            const foundVhost = vhosts[index];
            index = index + 1;

            if (!foundVhost || err) {
                res.statusCode = err ? (err.status || 500) : 404;
                res.end(err ? err.message : `no vhost for "${req.headers.host}"`);
                return;
            }

            foundVhost(req, res, next);
        }

        next();
    };
}

function dispatch(app, {host}) {
    return new Promise((resolve, reject) => {
        const req = {
            headers: {host}
        };

        const res = {
            statusCode: 200,
            end(body) {
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
