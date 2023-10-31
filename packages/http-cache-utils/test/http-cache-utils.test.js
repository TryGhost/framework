const assert = require('assert/strict');

const {isReqResUserSpecific} = require('../');

describe('Cache Utils', function () {
    describe('isReqResUserSpecific', function () {
        it('returns FALSY result for request/response pair containing NO user-identifying parameters', function () {
            let req, res;

            req = {
                get() {
                    return false;
                }
            };

            res = {
                get() {
                    return false;
                }
            };

            assert.equal(false, isReqResUserSpecific(req, res));
        });

        it('returns TRUTHY result for request/response pair containing user-identifying parameters', function () {
            let req, res;

            req = {
                get() {
                    return false;
                }
            };

            res = {
                get(header) {
                    if (header === 'set-cookie') {
                        return 'maui:cafebabe; MaxAge=42';
                    }
                }
            };

            assert(isReqResUserSpecific(req, res));

            req = {
                get(header) {
                    if (header === 'cookie') {
                        return 'PHPSESSID=298zf09hf012fh2; csrftoken=u32t4o3tb3gg43; _gat=1';
                    }
                }

            };

            res = {
                get() {
                    return false;
                }
            };

            assert(isReqResUserSpecific(req, res));

            req = {
                get(header) {
                    if (header === 'authorization') {
                        return 'Basic YWxhZGRpbjpvcGVuc2VzYW1l';
                    }
                }

            };

            res = {
                get() {
                    return false;
                }
            };

            assert(isReqResUserSpecific(req, res));
        });
    });
});
