require('./utils');
const {promisify} = require('util');
const {pool} = require('../');
const assert = require('assert/strict');

describe('Promise pool', function () {
    it('preserves order', function () {
        const tasks = [
            async function a() {
                await promisify(setTimeout)(100);
                return Promise.resolve('hello');
            },
            function b() {
                return Promise.resolve('hi');
            }
        ];
        return pool(tasks, 3)
            .then(function (result) {
                result.should.eql(['hello','hi']);
            });
    });

    it('handles mixed promises and values', function () {
        const tasks = [
            async function a() {
                return 'hello';
            },
            function b() {
                return Promise.resolve('hi');
            }
        ];
        return pool(tasks, 3)
            .then(function (result) {
                result.should.eql(['hello','hi']);
            });
    });

    it('does not allow less than 1 worker', async function () {
        const tasks = [
            async function a() {
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
            async function a() {
                return Promise.resolve('hi');
            },
            function b() {
                return Promise.resolve('hello');
            }
        ];

        pool(tasks, 100)
            .then(function (result) {
                result.should.eql(['hi','hello']);
            });
    });
});
