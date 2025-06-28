const {assert} = require('./utils');

const Agent = require('../lib/Agent');

describe('Agent', function () {
    describe('Class methods', function () {
        it('constructor sets app + defaults, & creates http verb methods', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            assert.equal(agent.app, fn);
            assert.equal(agent.defaults, opts);

            assert.equal(typeof agent.get, 'function');
            assert.equal(typeof agent.post, 'function');
            assert.equal(typeof agent.put, 'function');
            assert.equal(typeof agent.patch, 'function');
            assert.equal(typeof agent.delete, 'function');
            assert.equal(typeof agent.options, 'function');
            assert.equal(typeof agent.head, 'function');
        });

        it('constructor works without being passed defaults', function () {
            const fn = () => { };
            const agent = new Agent(fn);

            assert.equal(agent.app, fn);
            assert.deepEqual(agent.defaults, {});

            assert.equal(typeof agent.get, 'function');
            assert.equal(typeof agent.post, 'function');
            assert.equal(typeof agent.put, 'function');
            assert.equal(typeof agent.patch, 'function');
            assert.equal(typeof agent.delete, 'function');
            assert.equal(typeof agent.options, 'function');
            assert.equal(typeof agent.head, 'function');
        });

        it('_makeUrl without defaults', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/'), '/');
        });

        it('_makeUrl with baseUrl + slashes', function () {
            const fn = () => { };
            const opts = {
                baseUrl: '/base/'
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/'), '/base/');
        });

        it('_makeUrl with baseUrl + no slashes', function () {
            const fn = () => { };
            const opts = {
                baseUrl: 'base'
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/'), '/base/');
        });

        it('_makeUrl with baseUrl + override baseUrl', function () {
            const fn = () => { };
            const opts = {
                baseUrl: '/base/'
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/', {baseUrl: 'override'}), '/override/');
        });

        it('_makeUrl with query params', function () {
            const fn = () => { };
            const opts = {
                queryParams: {
                    key: 'very_secret'
                }
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/'), '/?key=very_secret');
        });

        it('_makeUrl with queryParams + override queryParams', function () {
            const fn = () => { };
            const opts = {
                queryParams: {
                    key: 'very_secret',
                    foo: 'bar'
                }
            };

            const overrides = {
                queryParams: {
                    key: 'not_so_secret',
                    bar: 'baz'
                }
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/', overrides), '/?key=not_so_secret&foo=bar&bar=baz');
        });

        it('_makeUrl with query params and existing query params', function () {
            const fn = () => { };
            const opts = {
                queryParams: {
                    key: 'very_secret'
                }
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/?hello=world'), '/?hello=world&key=very_secret');
        });

        it('_mergeOptions validation', function () {
            const fn = () => { };
            const opts = {
                baseUrl: 'base'
            };
            const agent = new Agent(fn, opts);

            const noOptions = () => {
                agent._mergeOptions();
            };

            const methodOnly = () => {
                agent._mergeOptions('GET');
            };

            const valid = () => {
                agent._mergeOptions('GET', '/');
            };

            assert.throws(noOptions);
            assert.throws(methodOnly);
            assert.doesNotThrow(valid);
        });

        it('_mergeOptions with no defaults or options', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            const options = agent._mergeOptions('GET', '/');
            assert.equal(options.method, 'GET');
            assert.equal(options.url, '/');
            assert.deepEqual(options.headers, {});
            assert.deepEqual(options.body, {});
        });

        it('_mergeOptions with defaults but no options', function () {
            const fn = () => { };
            const opts = {
                baseUrl: 'base',
                headers: {origin: 'localhost'},
                body: {hello: 'world'}
            };
            const agent = new Agent(fn, opts);

            const options = agent._mergeOptions('GET', '/', {});
            assert.equal(options.method, 'GET');
            assert.equal(options.url, '/base/');
            assert.deepEqual(options.headers, {origin: 'localhost'});
            assert.deepEqual(options.body, {hello: 'world'});
        });

        it('_mergeOptions with no defaults but all options', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            const options = agent._mergeOptions('GET', '/', {
                headers: {'content-type': 'application/json'},
                body: {foo: 'bar'}
            });
            assert.equal(options.method, 'GET');
            assert.equal(options.url, '/');
            assert.deepEqual(options.headers, {'content-type': 'application/json'});
            assert.deepEqual(options.body, {foo: 'bar'});
        });

        it('_mergeOptions with defaults and options', function () {
            const fn = () => { };
            const opts = {
                baseUrl: 'base',
                headers: {origin: 'localhost'},
                body: {hello: 'world'}
            };
            const agent = new Agent(fn, opts);

            const options = agent._mergeOptions('GET', '/', {
                headers: {'content-type': 'application/json'},
                body: {foo: 'bar'}
            });
            assert.equal(options.method, 'GET');
            assert.equal(options.url, '/base/');
            assert.deepEqual(options.headers, {origin: 'localhost', 'content-type': 'application/json'});
            assert.deepEqual(options.body, {hello: 'world', foo: 'bar'});
        });

        it('http verb methods error without url', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            const noUrl = () => {
                agent.get();
            };

            assert.throws(noUrl, {message: 'Cannot make a request without supplying a url'});
        });

        it('http verb methods (public interface)', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            const test = agent.get('/');

            assert.equal(test instanceof require('../lib/ExpectRequest'), true);
            assert.equal(test instanceof require('../lib/Request'), true);
            assert.equal(test.app, fn);
            assert.equal(test.reqOptions.method, 'GET');
            assert.equal(test.reqOptions.url, '/');
            assert.deepEqual(test.reqOptions.headers, {});
            assert.deepEqual(test.reqOptions.body, {});
        });

        it('clearCookies creates a new CookieJar and returns agent for chaining', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            const originalJar = agent.jar;
            const result = agent.clearCookies();

            assert.notEqual(agent.jar, originalJar, 'Should create a new CookieJar instance');
            assert.equal(result, agent, 'Should return agent for chaining');
            assert.equal(typeof agent.jar.setCookie, 'function', 'New jar should be a valid CookieJar');
        });

        it('clearCookies can be chained with other methods', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            const request = agent.clearCookies().get('/');

            assert.equal(request instanceof require('../lib/ExpectRequest'), true);
            assert.equal(request.reqOptions.method, 'GET');
            assert.equal(request.reqOptions.url, '/');
        });
    });
});
