import assert from 'assert/strict';
import {promisify} from 'util';
import {pool} from '../src/index.js';

describe('Promise pool', function () {
    it('preserves order', function () {
        const tasks = [
            async function a(): Promise<string> {
                await promisify(setTimeout)(100);
                return Promise.resolve('hello');
            },
            function b(): Promise<string> {
                return Promise.resolve('hi');
            }
        ];
        return pool(tasks, 3)
            .then(function (result) {
                assert.deepEqual(result, ['hello', 'hi']);
            });
    });

    it('handles mixed promises and values', function () {
        const tasks = [
            async function a(): Promise<string> {
                return 'hello';
            },
            function b(): Promise<string> {
                return Promise.resolve('hi');
            }
        ];
        return pool(tasks, 3)
            .then(function (result) {
                assert.deepEqual(result, ['hello', 'hi']);
            });
    });

    it('does not allow less than 1 worker', async function () {
        const tasks = [
            async function a(): Promise<string> {
                return 'hello';
            }
        ];

        await assert.rejects(pool(tasks, 0), {
            name: 'Error',
            message: 'Must set at least 1 concurrent workers'
        });
    });

    it('does not affect results to have more workers than tasks', function () {
        const tasks = [
            async function a(): Promise<string> {
                return Promise.resolve('hi');
            },
            function b(): Promise<string> {
                return Promise.resolve('hello');
            }
        ];

        return pool(tasks, 100)
            .then(function (result) {
                assert.deepEqual(result, ['hi', 'hello']);
            });
    });
});
