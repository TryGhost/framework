const assert = require('assert/strict');
const sinon = require('sinon');
const {sequence} = require('../');

describe('Unit: lib/promise/sequence', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('mixed tasks: promise and none promise', function () {
        const tasks = [
            function a() {
                return Promise.resolve('hello');
            },
            function b() {
                return 'from';
            },
            function c() {
                return Promise.resolve('chio');
            }
        ];
        return sequence(tasks)
            .then(function (result) {
                assert.deepEqual(result, ['hello', 'from', 'chio']);
            });
    });
});
