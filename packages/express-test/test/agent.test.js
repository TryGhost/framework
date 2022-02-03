const {assert} = require('./utils');

const Agent = require('../lib/agent');

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
            assert.equal(typeof agent.del, 'function');
        });

        it('_makeUrl without defaults', function () {
            const fn = () => { };
            const opts = {};
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/'), '/');
        });

        it('_makeUrl with defaults + slashes', function () {
            const fn = () => { };
            const opts = {
                baseUrl: '/base/'
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/'), '/base/');
        });

        it('_makeUrl with defaults + no slashes', function () {
            const fn = () => { };
            const opts = {
                baseUrl: 'base'
            };
            const agent = new Agent(fn, opts);

            assert.equal(agent._makeUrl('/'), '/base/');
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

            assert.equal(test instanceof require('../lib/expect-request'), true);
            assert.equal(test instanceof require('../lib/request'), true);
            assert.equal(test.app, fn);
            assert.equal(test.reqOptions.method, 'GET');
            assert.equal(test.reqOptions.url, '/');
            assert.deepEqual(test.reqOptions.headers, {});
            assert.deepEqual(test.reqOptions.body, {});
        });
    });
});
