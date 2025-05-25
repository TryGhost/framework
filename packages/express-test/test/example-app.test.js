const {assert} = require('./utils');

const Agent = require('../'); // we require the root file
const app = require('../example/app');
const {any} = require('@tryghost/jest-snapshot');
const {promises: fs, createReadStream} = require('node:fs');
const FormData = require('form-data');
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

    it('GET / works', async function () {
        try {
            const {statusCode, text} = await agent.get('/');
            assert.equal(statusCode, 200);
            assert.equal(text, 'Hello World!');
        } catch (error) {
            assert.fail(`Should not have thrown an error', but got ${error.stack}`);
        }
    });

    it('GET /idontexist 404s', async function () {
        try {
            const {statusCode, text} = await agent.get('/idontexist');
            assert.equal(statusCode, 404);
            assert.match(text, /Cannot GET \/idontexist/);
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

        it('cannot create a session without valid credentials', async function () {
            const sessionRes = await agent.post('/session/', {
                body: {
                    username: 'hello'
                }
            });

            assert.equal(sessionRes.statusCode, 401);
            assert.deepEqual(Object.keys(sessionRes.headers), ['x-powered-by', 'content-type', 'content-length', 'etag']);
            assert.deepEqual(sessionRes.body, {});
            assert.equal(sessionRes.text, 'Unauthorized');
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

    describe('Set & Expect', function () {
        before(async function () {
            agent = await getAgent();
        });

        it('set headers but not body using reqOptions', async function () {
            const {statusCode, headers, body} = await agent
                .post('/check/', {
                    headers: {'x-check': true}
                });

            assert.equal(statusCode, 200);
            assert.deepEqual(body, {});
            assert.equal(headers['x-checked'], 'true');
        });

        it('set headers, status and body using reqOptions', async function () {
            const {statusCode, headers, body} = await agent
                .post('/check/', {
                    body: {foo: 'bar'},
                    headers: {'x-check': true}
                });

            assert.equal(statusCode, 200);
            assert.deepEqual(body, {foo: 'bar'});
            assert.equal(headers['x-checked'], 'true');
        });

        it('set headers, status and body using set chaining', async function () {
            const {statusCode, headers, body} = await agent
                .post('/check/')
                .body({foo: 'bar'})
                .header('x-check', true);

            assert.equal(statusCode, 200);
            assert.deepEqual(body, {foo: 'bar'});
            assert.equal(headers['x-checked'], 'true');
        });

        it('set headers, status and body with mixed-case header', async function () {
            const {statusCode, headers, body} = await agent
                .post('/check/', {
                    body: {foo: 'bar'},
                    headers: {'X-Check': true}
                });

            assert.equal(statusCode, 200);
            assert.deepEqual(body, {foo: 'bar'});
            assert.equal(headers['x-checked'], 'true');
        });

        it('set headers, status and body with mixed-case header and chaining', async function () {
            const {statusCode, headers, body} = await agent
                .post('/check/')
                .body({foo: 'bar'})
                .header('X-Check', true);

            assert.equal(statusCode, 200);
            assert.deepEqual(body, {foo: 'bar'});
            assert.equal(headers['x-checked'], 'true');
        });

        it('check headers, status and body using set and expect chaining', async function () {
            await agent
                .post('/check/')
                .body({foo: 'bar'})
                .header('x-check', true)
                .expectStatus(200)
                .expectHeader('x-checked', 'true')
                .expect(({body}) => {
                    assert.deepEqual(body, {foo: 'bar'});
                });
        });

        it('check headers, status and body using set, expect chaining & snapshot matching', async function () {
            await agent
                .post('/check/')
                .body({foo: 'bar'})
                .header('x-check', true)
                .expectStatus(200)
                .expectHeader('x-checked', 'true')
                .matchBodySnapshot()
                .matchHeaderSnapshot();
        });

        it('check status using expect chaining errors correctly', async function () {
            await assert.rejects(async () => {
                return await agent
                    .post('/check/')
                    .expectStatus(404);
            }), {message: 'Expected header "x-checked: false", got "x-checked: true" POST request on /check/'};
        });

        it('check headers, status and empty body using set and expect chaining', async function () {
            await agent
                .post('/check/')
                .header('x-check', true)
                .expectStatus(200)
                .expectHeader('x-checked', 'true')
                .expectEmptyBody();
        });

        it('check header using expect chaining errors correctly', async function () {
            await assert.rejects(async () => {
                return await agent
                    .post('/check/')
                    .header('x-check', true)
                    .expectStatus(200)
                    .expectHeader('x-checked', 'false');
            }, {message: 'Expected header "x-checked: false", got "x-checked: true" POST request on /check/'});
        });

        it('check body using expect chaining errors correctly', async function () {
            await assert.rejects(async () => {
                return await agent
                    .post('/check/')
                    .body({foo: 'bar'})
                    .expect(({body}) => {
                        assert.deepEqual(body, {foo: 'ba'});
                    });
            }, (error) => {
                assert.match(error.message, /^Expected values to be loosely deep-equal/);
                return true;
            });
        });

        it('check empty body using expect chaining errors correctly', async function () {
            await assert.rejects(async () => {
                return await agent
                    .post('/check/')
                    .body({foo: 'bar'})
                    .expectEmptyBody();
            }, (error) => {
                assert.match(error.message, /^Expected body to be empty, got/);
                return true;
            });
        });

        it('check body using snapshot matching errors correctly for missing property', async function () {
            await assert.rejects(async () => {
                return await agent
                    .post('/check/')
                    .body({
                        foo: 'bar'
                    })
                    .matchBodySnapshot({
                        id: any(String)
                    });
            }, (error) => {
                assert.match(error.message, /check body using snapshot matching errors correctly for missing property/);
                assert.match(error.message, /\[body\]/);
                assert.match(error.message, /Expected properties {2}- 1/);
                assert.match(error.message, /Received value {2,}\+ 1/);
                return true;
            });
        });

        it('check body using snapshot matching errors correctly for random data', async function () {
            await assert.rejects(async () => {
                return await agent
                    .post('/check/')
                    .body({
                        foo: 'bar',
                        id: Math.random().toString(36)
                    })
                    .matchBodySnapshot();
            }, (error) => {
                assert.match(error.message, /check body using snapshot matching errors correctly for random data/);
                assert.match(error.message, /\[body\]/);
                assert.match(error.message, /Snapshot {2}- 1/);
                assert.match(error.message, /Received {2}\+ 1/);
                return true;
            });
        });

        it('check body using snapshot matching properties works for random data', async function () {
            await agent
                .post('/check/')
                .body({
                    foo: 'bar',
                    id: Math.random().toString(36)
                })
                .matchBodySnapshot({
                    id: any(String)
                });
        });

        it('can send the body as a string', async function () {
            const data = {foo: 'bar', nested: {foo: 'bar'}};
            await agent
                .post('/api/ping/')
                .body(JSON.stringify(data))
                .header('content-type', 'application/json')
                .expectStatus(200)
                .expect(({body}) => {
                    assert.deepEqual(body, data);
                });
        });

        it('can upload a file', async function () {
            const fileContents = await fs.readFile(__dirname + '/fixtures/ghost-favicon.png');
            const filename = 'test.png';
            const contentType = 'image/png';

            const form = new FormData();
            form.append('image', fileContents, {
                filename,
                contentType
            });

            const {body} = await agent
                .post('/api/upload/')
                .body(form)
                .expectStatus(200);

            assert.equal(body.originalname, filename);
            assert.equal(body.mimetype, contentType);
            assert.equal(body.size, fileContents.length);
            assert.equal(body.fieldname, 'image');

            // Do a real comparison in the uploaded file to check if it was uploaded and saved correctly
            const uploadedFileContents = await fs.readFile(body.path);
            assert.deepEqual(uploadedFileContents, fileContents);

            // Delete the file
            try {
                await fs.unlink(body.path);
            } catch (e) {
                // ignore if this fails
            }
        });

        it('can upload a file using the attach method', async function () {
            const fileContents = await fs.readFile(__dirname + '/fixtures/ghost-favicon.png');

            const {body} = await agent
                .post('/api/upload/')
                .attach('image', __dirname + '/fixtures/ghost-favicon.png')
                .expectStatus(200);

            assert.equal(body.originalname, 'ghost-favicon.png');
            assert.equal(body.mimetype, 'image/png');
            assert.equal(body.size, fileContents.length);
            assert.equal(body.fieldname, 'image');

            // Do a real comparison in the uploaded file to check if it was uploaded and saved correctly
            const uploadedFileContents = await fs.readFile(body.path);
            assert.deepEqual(uploadedFileContents, fileContents);

            // Delete the file
            try {
                await fs.unlink(body.path);
            } catch (e) {
                // ignore if this fails
            }
        });

        it('can stream body', async function () {
            const stat = await fs.stat(__dirname + '/fixtures/long-json-body.json');
            const stream = createReadStream(__dirname + '/fixtures/long-json-body.json');

            const {body} = await agent
                .post('/api/ping/')
                .header('content-type', 'application/json')
                .header('content-length', stat.size) // the Express json middleware requires content-length to work
                .stream(stream)
                .expectStatus(200);

            const fileContents = await fs.readFile(__dirname + '/fixtures/long-json-body.json', 'utf8');
            assert.equal(JSON.stringify(body) + '\n', fileContents);
        });
    });
});
