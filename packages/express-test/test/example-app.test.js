const {assert} = require('./utils');

const Agent = require('../'); // we require the root file
const app = require('../example/app');
const {before} = require('mocha');

let agent;

/**
 * These functions are async because in a real world scenario,
 * the function that loads "app" would be async.
 * This has a huge impact as await will call .then if available
 * this is the entire reason for splitting Agent and Request
 * So we want to test it is working!
 */

async function getAgent() {
    return new Agent(app);
}

async function getAPIAgent() {
    return new Agent(app, {baseUrl: '/api/'});
}

async function getExtendedAPIAgent() {
    agent = await getAPIAgent();

    agent.login = async function () {
        return await agent.post('/session/', {
            body: {
                username: 'hello',
                password: 'world'
            }
        });
    };

    return agent;
}

describe('Example App', function () {
    before(async function () {
        agent = await getAgent();
    });

    describe('Object Destructuring', function () {
        it('Basic test of GET /', async function () {
            try {
                const {statusCode, text} = await agent.get('/');
                assert.equal(statusCode, 200);
                assert.equal(text, 'Hello World!');
            } catch (error) {
                assert.fail(`Should not have thrown an error', but got ${error.stack}`);
            }
        });

        describe('API Agent with authentication in two steps', function () {
            before(async function () {
                agent = await getAPIAgent();
            });

            it('cannot perform request without session', async function () {
                const {statusCode, headers, body, text} = await agent.get('/foo/');

                assert.equal(statusCode, 403);
                assert.deepEqual(Object.keys(headers), ['x-powered-by', 'content-type', 'content-length', 'etag']);
                assert.deepEqual(body, {});
                assert.equal(text, 'Forbidden');
            });

            it('create session & make authenticated request', async function () {
                const sessionRes = await agent.post('/session/', {
                    body: {
                        username: 'hello',
                        password: 'world'
                    }
                });

                assert.equal(sessionRes.statusCode, 200);
                assert.deepEqual(Object.keys(sessionRes.headers), ['x-powered-by', 'content-type', 'content-length', 'etag', 'set-cookie']);
                assert.deepEqual(sessionRes.body, {});
                assert.equal(sessionRes.text, 'OK');

                const {statusCode, headers, body, text} = await agent.get('/foo/');

                assert.equal(statusCode, 200);
                assert.deepEqual(Object.keys(headers), ['x-powered-by', 'content-type', 'content-length', 'etag']);
                assert.deepEqual(body, {foo: [{bar: 'baz'}]});
                assert.equal(text, '{"foo":[{"bar":"baz"}]}');
            });
        });

        describe('API Agent with login function', function () {
            before(async function () {
                agent = await getExtendedAPIAgent();
                await agent.login();
            });

            it('make an authenticated request', async function () {
                const {statusCode, headers, body, text} = await agent.get('/foo/');

                assert.equal(statusCode, 200);
                assert.deepEqual(Object.keys(headers), ['x-powered-by', 'content-type', 'content-length', 'etag']);
                assert.deepEqual(body, {foo: [{bar: 'baz'}]});
                assert.equal(text, '{"foo":[{"bar":"baz"}]}');
            });
        });

        describe('headers and body', function () {
            before(async function () {
                agent = await getAgent();
            });

            it('check headers and body using reqOptions', async function () {
                const {statusCode, headers, body} = await agent
                    .post('/check/', {
                        body: {foo: 'bar'},
                        headers: {'x-check': true}
                    });

                assert.equal(statusCode, 200);
                assert.deepEqual(body, {foo: 'bar'});
                assert.equal(headers['x-checked'], 'true');
            });

            it('check headers and body using set chaining', async function () {
                const {statusCode, headers, body} = await agent
                    .post('/check/')
                    .body({foo: 'bar'})
                    .header('x-check', true);

                assert.equal(statusCode, 200);
                assert.deepEqual(body, {foo: 'bar'});
                assert.equal(headers['x-checked'], 'true');
            });

            it('check headers and body using set and expect chaining', async function () {
                const {body} = await agent
                    .post('/check/')
                    .body({foo: 'bar'})
                    .header('x-check', true)
                    .expectStatus(200)
                    .expectHeader('x-checked', 'true');

                assert.deepEqual(body, {foo: 'bar'});
            });
        });
    });
});
