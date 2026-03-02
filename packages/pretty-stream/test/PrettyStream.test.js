const assert = require('assert/strict');
const PrettyStream = require('../index');
const Writable = require('stream').Writable;
const sinon = require('sinon');

describe('PrettyStream', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('short mode', function () {
        it('data.msg', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    msg: 'Ghost starts now.'
                }));
            });
        });

        it('data.err', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m message\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[1m\u001b[37mError Code: \u001b[39m\u001b[22m\n    \u001b[90mHEY_JUDE\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 50,
                    msg: 'message',
                    err: {
                        message: 'Hey Jude!',
                        stack: 'stack',
                        code: 'HEY_JUDE'
                    }
                }));
            });
        });

        it('data.req && data.res', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m "GET /test" \u001b[32m200\u001b[39m 39ms\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    req: {
                        originalUrl: '/test',
                        method: 'GET',
                        body: {
                            a: 'b'
                        }
                    },
                    res: {
                        statusCode: 200,
                        responseTime: '39ms'
                    }
                }));
            });
        });

        it('data.req && data.res && data.err', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m "GET /test" \u001b[33m400\u001b[39m 39ms\n\u001b[31m\n\u001b[31mmessage\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 50,
                    req: {
                        originalUrl: '/test',
                        method: 'GET',
                        body: {
                            a: 'b'
                        }
                    },
                    res: {
                        statusCode: 400,
                        responseTime: '39ms'
                    },
                    err: {
                        message: 'message',
                        stack: 'stack'
                    }
                }));
            });
        });
    });

    describe('long mode', function () {
        it('data.msg', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    msg: 'Ghost starts now.'
                }));
            });
        });

        it('data.err', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\u001b[39m\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 50,
                    err: {
                        message: 'Hey Jude!',
                        stack: 'stack'
                    }
                }));
            });
        });

        it('data.req && data.res', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m "GET /test" \u001b[32m200\u001b[39m 39ms\n\u001b[90m\n\u001b[33mREQ\u001b[39m\n\u001b[32mip: \u001b[39m         127.0.01\n\u001b[32moriginalUrl: \u001b[39m/test\n\u001b[32mmethod: \u001b[39m     GET\n\u001b[32mbody: \u001b[39m\n  \u001b[32ma: \u001b[39mb\n\n\u001b[33mRES\u001b[39m\n\u001b[32mresponseTime: \u001b[39m39ms\n\u001b[39m\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    req: {
                        ip: '127.0.01',
                        originalUrl: '/test',
                        method: 'GET',
                        body: {
                            a: 'b'
                        }
                    },
                    res: {
                        statusCode: 200,
                        responseTime: '39ms'
                    }
                }));
            });
        });

        it('data.req && data.res && data.err', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m "GET /test" \u001b[33m400\u001b[39m 39ms\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\n\u001b[33mREQ\u001b[39m\n\u001b[32moriginalUrl: \u001b[39m/test\n\u001b[32mmethod: \u001b[39m     GET\n\u001b[32mbody: \u001b[39m\n  \u001b[32ma: \u001b[39mb\n\n\u001b[33mRES\u001b[39m\n\u001b[32mresponseTime: \u001b[39m39ms\n\u001b[39m\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 50,
                    req: {
                        originalUrl: '/test',
                        method: 'GET',
                        body: {
                            a: 'b'
                        }
                    },
                    res: {
                        statusCode: 400,
                        responseTime: '39ms'
                    },
                    err: {
                        message: 'Hey Jude!',
                        stack: 'stack'
                    }
                }));
            });
        });

        it('data.err contains error details && meta fields', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m\n\u001b[31m\n\u001b[31mType: ValidationError\u001b[39m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[37m{"a":"b"}\u001b[39m\n\u001b[33mCheck documentation at https://docs.ghost.org/\u001b[39m\n\n\u001b[1m\u001b[37mError ID:\u001b[39m\u001b[22m\n    \u001b[90me8546680-401f-11e9-99a7-ed7d6251b35c\u001b[39m\n\n\u001b[1m\u001b[37mDetails:\u001b[39m\u001b[22m\n\u001b[90m    level:    error\n    rule:     Templates must contain valid Handlebars.\n    failures: \n      - \n        ref:     default.hbs\n        message: Missing helper: "image"\n    code:     GS005-TPL-ERR\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\u001b[39m\n');
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 50,
                    err: {
                        message: 'Hey Jude!',
                        stack: 'stack',
                        errorType: 'ValidationError',
                        id: 'e8546680-401f-11e9-99a7-ed7d6251b35c',
                        context: JSON.stringify({a: 'b'}),
                        help: 'Check documentation at https://docs.ghost.org/',
                        errorDetails: JSON.stringify([{
                            level: 'error',
                            rule: 'Templates must contain valid Handlebars.',
                            failures: [{ref: 'default.hbs', message: 'Missing helper: "image"'}],
                            code: 'GS005-TPL-ERR'
                        }])
                    }
                }));
            });
        });

        it('data with no time field', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                // Hardcode the datetime so we don't have flaky tests
                sinon.useFakeTimers(new Date('2024-12-15T13:17:00.000'));

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data, `[2024-12-15 13:17:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n`);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                // Write the body with no time field
                ghostPrettyStream.write(JSON.stringify({
                    level: 30,
                    msg: 'Ghost starts now.'
                }));
            });
        });
    });
    describe('edge paths', function () {
        it('defaults to short mode when no options are provided', function () {
            var ghostPrettyStream = new PrettyStream();
            assert.equal(ghostPrettyStream.mode, 'short');
        });

        it('accepts plain object writes and stringifies internally', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data.includes('Object input'), true);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);
                ghostPrettyStream.write({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    msg: 'Object input'
                });
            });
        });

        it('handles invalid JSON input in _transform', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                ghostPrettyStream._transform(Buffer.from('{not-json'), null, (err) => {
                    assert.notEqual(err, null);
                    resolve();
                });
            });
        });

        it('renders raw errorDetails when parsing details fails', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data.includes('Details:'), true);
                    assert.equal(data.includes('not-json-details'), true);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);
                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 50,
                    err: {
                        message: 'oops',
                        stack: 'stack',
                        errorDetails: 'not-json-details'
                    }
                }));
            });
        });

        it('renders parsed object errorDetails payloads', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data.includes('Details:'), true);
                    assert.equal(data.includes('CODE1'), true);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);
                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 50,
                    err: {
                        message: 'oops',
                        stack: 'stack',
                        errorDetails: JSON.stringify({code: 'CODE1'})
                    }
                }));
            });
        });

        it('renders non-object additional fields', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'long'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data.includes('plain-extra-value'), true);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);
                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    msg: 'hello',
                    extra: 'plain-extra-value'
                }));
            });
        });

        it('colors 500 status code as red', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data.includes('\u001b[31m500\u001b[39m'), true);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    req: {originalUrl: '/a', method: 'GET'},
                    res: {statusCode: 500, responseTime: '1ms'}
                }));
            });
        });

        it('colors 301 status code as cyan', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data.includes('\u001b[36m301\u001b[39m'), true);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    req: {originalUrl: '/b', method: 'GET'},
                    res: {statusCode: 301, responseTime: '1ms'}
                }));
            });
        });

        it('colors <200 status code with default color', async function () {
            await new Promise((resolve) => {
                var ghostPrettyStream = new PrettyStream({mode: 'short'});
                var writeStream = new Writable();

                writeStream._write = function (data) {
                    data = data.toString();
                    assert.equal(data.includes('\u001b[39m100\u001b[39m'), true);
                    resolve();
                };

                ghostPrettyStream.pipe(writeStream);

                ghostPrettyStream.write(JSON.stringify({
                    time: '2016-07-01 00:00:00',
                    level: 30,
                    req: {originalUrl: '/c', method: 'GET'},
                    res: {statusCode: 100, responseTime: '1ms'}
                }));
            });
        });
    });
});
