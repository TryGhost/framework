// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');
const PrettyStream = require('../index');
const Writable = require('stream').Writable;
const sinon = require('sinon');

describe('PrettyStream', function () {
    describe('short mode', function () {
        it('data.msg', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n');
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                msg: 'Ghost starts now.'
            }));
        });

        it('data.err', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m message\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[1m\u001b[37mError Code: \u001b[39m\u001b[22m\n    \u001b[90mHEY_JUDE\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n');
                done();
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

        it('data.req && data.res', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m "GET /test" \u001b[32m200\u001b[39m 39ms\n');
                done();
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

        it('data.req && data.res && data.err', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m "GET /test" \u001b[33m400\u001b[39m 39ms\n\u001b[31m\n\u001b[31mmessage\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n');
                done();
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

    describe('long mode', function () {
        it('data.msg', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n');
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                msg: 'Ghost starts now.'
            }));
        });

        it('data.err', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\u001b[39m\n');
                done();
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

        it('data.req && data.res', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m "GET /test" \u001b[32m200\u001b[39m 39ms\n\u001b[90m\n\u001b[33mREQ\u001b[39m\n\u001b[32mip: \u001b[39m         127.0.01\n\u001b[32moriginalUrl: \u001b[39m/test\n\u001b[32mmethod: \u001b[39m     GET\n\u001b[32mbody: \u001b[39m\n  \u001b[32ma: \u001b[39mb\n\n\u001b[33mRES\u001b[39m\n\u001b[32mresponseTime: \u001b[39m39ms\n\u001b[39m\n');
                done();
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

        it('data.req && data.res && data.err', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m "GET /test" \u001b[33m400\u001b[39m 39ms\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\n\u001b[33mREQ\u001b[39m\n\u001b[32moriginalUrl: \u001b[39m/test\n\u001b[32mmethod: \u001b[39m     GET\n\u001b[32mbody: \u001b[39m\n  \u001b[32ma: \u001b[39mb\n\n\u001b[33mRES\u001b[39m\n\u001b[32mresponseTime: \u001b[39m39ms\n\u001b[39m\n');
                done();
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

        it('data.err contains error details && meta fields', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql('[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m\n\u001b[31m\n\u001b[31mType: ValidationError\u001b[39m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[37m{"a":"b"}\u001b[39m\n\u001b[33mCheck documentation at https://docs.ghost.org/\u001b[39m\n\n\u001b[1m\u001b[37mError ID:\u001b[39m\u001b[22m\n    \u001b[90me8546680-401f-11e9-99a7-ed7d6251b35c\u001b[39m\n\n\u001b[1m\u001b[37mDetails:\u001b[39m\u001b[22m\n\u001b[90m    level:    error\n    rule:     Templates must contain valid Handlebars.\n    failures: \n      - \n        ref:     default.hbs\n        message: Missing helper: "image"\n    code:     GS005-TPL-ERR\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\u001b[39m\n');
                done();
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

        it('data with no time field', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            // Hardcode the datetime so we don't have flaky tests
            sinon.useFakeTimers(new Date('2024-12-15T13:17:00.000Z'));

            writeStream._write = function (data) {
                data = data.toString();
                data.should.eql(`[2024-12-15 13:17:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n`);
                done();
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
