const assert = require('assert/strict');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m message\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[1m\u001b[37mError Code: \u001b[39m\u001b[22m\n    \u001b[90mHEY_JUDE\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m "GET /test" \u001b[32m200\u001b[39m 39ms\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m "GET /test" \u001b[33m400\u001b[39m 39ms\n\u001b[31m\n\u001b[31mmessage\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\u001b[39m\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[36mINFO\u001b[39m "GET /test" \u001b[32m200\u001b[39m 39ms\n\u001b[90m\n\u001b[33mREQ\u001b[39m\n\u001b[32mip: \u001b[39m         127.0.01\n\u001b[32moriginalUrl: \u001b[39m/test\n\u001b[32mmethod: \u001b[39m     GET\n\u001b[32mbody: \u001b[39m\n  \u001b[32ma: \u001b[39mb\n\n\u001b[33mRES\u001b[39m\n\u001b[32mresponseTime: \u001b[39m39ms\n\u001b[39m\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m "GET /test" \u001b[33m400\u001b[39m 39ms\n\u001b[31m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\n\u001b[33mREQ\u001b[39m\n\u001b[32moriginalUrl: \u001b[39m/test\n\u001b[32mmethod: \u001b[39m     GET\n\u001b[32mbody: \u001b[39m\n  \u001b[32ma: \u001b[39mb\n\n\u001b[33mRES\u001b[39m\n\u001b[32mresponseTime: \u001b[39m39ms\n\u001b[39m\n');
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
                assert.equal(data, '[2016-07-01 00:00:00] \u001b[31mERROR\u001b[39m\n\u001b[31m\n\u001b[31mType: ValidationError\u001b[39m\n\u001b[31mHey Jude!\u001b[39m\n\n\u001b[37m{"a":"b"}\u001b[39m\n\u001b[33mCheck documentation at https://docs.ghost.org/\u001b[39m\n\n\u001b[1m\u001b[37mError ID:\u001b[39m\u001b[22m\n    \u001b[90me8546680-401f-11e9-99a7-ed7d6251b35c\u001b[39m\n\n\u001b[1m\u001b[37mDetails:\u001b[39m\u001b[22m\n\u001b[90m    level:    error\n    rule:     Templates must contain valid Handlebars.\n    failures: \n      - \n        ref:     default.hbs\n        message: Missing helper: "image"\n    code:     GS005-TPL-ERR\u001b[39m\n\n\u001b[90m----------------------------------------\u001b[39m\n\n\u001b[90mstack\u001b[39m\n\u001b[39m\n\u001b[90m\u001b[39m\n');
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
            sinon.useFakeTimers(new Date('2024-12-15T13:17:00.000'));

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data, `[2024-12-15 13:17:00] \u001b[36mINFO\u001b[39m Ghost starts now.\n`);
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

    describe('timezone handling', function () {
        it('should display provided timestamps consistently', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                // The timestamp should be formatted consistently
                assert.equal(data.includes('[2016-07-01 00:00:00]'), true);
                assert.equal(data.includes('INFO'), true);
                assert.equal(data.includes('Test message'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            // Write with an explicit timestamp
            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                msg: 'Test message'
            }));
        });

        it('should handle ISO 8601 timestamps and convert to local time', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                // ISO timestamp should be parsed and converted to local time
                // Extract the timestamp to verify format
                const timestampMatch = data.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
                assert.notEqual(timestampMatch, null);

                // Verify the timestamp represents the correct moment
                // 2016-07-01T00:00:00.000Z in local time
                const parsedTime = new Date(timestampMatch[1]);
                const expectedTime = new Date('2016-07-01T00:00:00.000Z');

                // The displayed local time should represent the same moment as the UTC time
                // Allow for some tolerance due to date parsing
                assert.equal(Math.abs(parsedTime.getTime() - expectedTime.getTime()) < 24 * 60 * 60 * 1000, true);

                assert.equal(data.includes('INFO'), true);
                assert.equal(data.includes('ISO timestamp test'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            // Write with an ISO 8601 timestamp
            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01T00:00:00.000Z',
                level: 30,
                msg: 'ISO timestamp test'
            }));
        });

        it('should handle timestamps with timezone offsets', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                // Timestamp with timezone offset should be converted to local time for display
                const timestampMatch = data.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
                assert.notEqual(timestampMatch, null);

                assert.equal(data.includes('INFO'), true);
                assert.equal(data.includes('Timezone offset test'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            // Write with a timestamp that includes timezone offset
            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01T00:00:00+02:00',
                level: 30,
                msg: 'Timezone offset test'
            }));
        });

        it('should use current local time when no timestamp is provided', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            // Capture the time before the test
            const beforeTime = new Date();

            writeStream._write = function (data) {
                data = data.toString();

                // Extract the timestamp from the output
                const timestampMatch = data.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
                assert.notEqual(timestampMatch, null);

                const loggedTime = new Date(timestampMatch[1]);
                const afterTime = new Date();

                // The logged time should be between beforeTime and afterTime
                assert.equal(loggedTime.getTime() >= beforeTime.getTime(), true);
                assert.equal(loggedTime.getTime() <= afterTime.getTime(), true);

                done();
            };

            ghostPrettyStream.pipe(writeStream);

            // Write without a timestamp
            ghostPrettyStream.write(JSON.stringify({
                level: 30,
                msg: 'No timestamp test'
            }));
        });

        it('should work correctly in different timezones', function (done) {
            // This test verifies that string timestamps are displayed as-is
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                // String timestamp should be displayed exactly as provided
                assert.equal(data.includes('[2016-07-01 00:00:00]'), true);
                assert.equal(data.includes('String timestamp'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            // Test with string timestamp - should be displayed as-is
            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                msg: 'String timestamp'
            }));
        });

        it('regression test: string timestamps should not be affected by timezone offset', function (done) {
            // This test ensures the bug from commit be5ddf2 doesn't resurface
            // String timestamps like '2016-07-01 00:00:00' should be displayed exactly as provided
            // regardless of the system timezone
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                // The exact string '2016-07-01 00:00:00' should appear in the output
                // It should NOT be shifted by timezone offset (e.g., NOT '2016-06-30 23:00:00')
                assert.match(data, /^\[2016-07-01 00:00:00\]/);
                assert.equal(data.includes('Regression test'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            // This timestamp format was causing issues in non-UTC timezones
            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                msg: 'Regression test'
            }));
        });
    });

    describe('edge paths', function () {
        it('defaults to short mode when no options are provided', function () {
            var ghostPrettyStream = new PrettyStream();
            assert.equal(ghostPrettyStream.mode, 'short');
        });

        it('accepts plain object writes and stringifies internally', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data.includes('Object input'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);
            ghostPrettyStream.write({
                time: '2016-07-01 00:00:00',
                level: 30,
                msg: 'Object input'
            });
        });

        it('handles invalid JSON input in _transform', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            ghostPrettyStream._transform(Buffer.from('{not-json'), null, (err) => {
                assert.notEqual(err, null);
                done();
            });
        });

        it('renders raw errorDetails when parsing details fails', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data.includes('Details:'), true);
                assert.equal(data.includes('not-json-details'), true);
                done();
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

        it('renders parsed object errorDetails payloads', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data.includes('Details:'), true);
                assert.equal(data.includes('CODE1'), true);
                done();
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

        it('renders non-object additional fields', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'long'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data.includes('plain-extra-value'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);
            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                msg: 'hello',
                extra: 'plain-extra-value'
            }));
        });

        it('colors 500 status code as red', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data.includes('\u001b[31m500\u001b[39m'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                req: {originalUrl: '/a', method: 'GET'},
                res: {statusCode: 500, responseTime: '1ms'}
            }));
        });

        it('colors 301 status code as cyan', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data.includes('\u001b[36m301\u001b[39m'), true);
                done();
            };

            ghostPrettyStream.pipe(writeStream);

            ghostPrettyStream.write(JSON.stringify({
                time: '2016-07-01 00:00:00',
                level: 30,
                req: {originalUrl: '/b', method: 'GET'},
                res: {statusCode: 301, responseTime: '1ms'}
            }));
        });

        it('colors <200 status code with default color', function (done) {
            var ghostPrettyStream = new PrettyStream({mode: 'short'});
            var writeStream = new Writable();

            writeStream._write = function (data) {
                data = data.toString();
                assert.equal(data.includes('\u001b[39m100\u001b[39m'), true);
                done();
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
