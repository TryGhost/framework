import assert from 'assert/strict';

import {isReqResUserSpecific} from '../src/index.js';

describe('Cache Utils', function () {
    describe('isReqResUserSpecific', function () {
        it('returns FALSY result for request/response pair containing NO user-identifying parameters', function () {
            const req = {
                get(): false {
                    return false;
                }
            };

            const res = {
                get(): false {
                    return false;
                }
            };

            assert.equal(false, isReqResUserSpecific(req, res));
        });

        it('returns TRUTHY result for request/response pair containing user-identifying parameters', function () {
            let req = {
                get(): false {
                    return false;
                }
            };

            let res: { get(header: string): string | false | undefined } = {
                get(header: string): string | undefined {
                    if (header === 'set-cookie') {
                        return 'maui:cafebabe; MaxAge=42';
                    }
                    return undefined;
                }
            };

            assert(isReqResUserSpecific(req, res));

            req = {
                get(header: string): false | string {
                    if (header === 'cookie') {
                        return 'PHPSESSID=298zf09hf012fh2; csrftoken=u32t4o3tb3gg43; _gat=1';
                    }
                    return false;
                }
            };

            res = {
                get(): false {
                    return false;
                }
            };

            assert(isReqResUserSpecific(req, res));

            req = {
                get(header: string): false | string {
                    if (header === 'authorization') {
                        return 'Basic YWxhZGRpbjpvcGVuc2VzYW1l';
                    }
                    return false;
                }
            };

            res = {
                get(): false {
                    return false;
                }
            };

            assert(isReqResUserSpecific(req, res));
        });
    });
});
