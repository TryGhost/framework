import assert from 'assert/strict';
import sinon from 'sinon';
import {sequence} from '../src/index.js';

describe('Unit: lib/promise/sequence', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('mixed tasks: promise and none promise', function () {
        const tasks = [
            function a(): Promise<string> {
                return Promise.resolve('hello');
            },
            function b(): string {
                return 'from';
            },
            function c(): Promise<string> {
                return Promise.resolve('chio');
            }
        ];
        return sequence(tasks)
            .then(function (result) {
                assert.deepEqual(result, ['hello', 'from', 'chio']);
            });
    });
});
