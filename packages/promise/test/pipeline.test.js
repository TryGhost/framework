const assert = require('assert/strict');
const sinon = require('sinon');

// Stuff we are testing
const {pipeline} = require('../');

// These tests are based on the tests in https://github.com/cujojs/when/blob/3.7.4/test/pipeline-test.js
function createTask(y) {
    return function (x) {
        return x + y;
    };
}

describe('Pipeline', function () {
    afterEach(function () {
        sinon.restore();
    });

    it('should execute tasks in order', function () {
        return pipeline([createTask('b'), createTask('c'), createTask('d')], 'a').then(function (result) {
            assert.equal(result, 'abcd');
        });
    });

    it('should resolve to initial args when no tasks supplied', function () {
        return pipeline([], 'a', 'b').then(function (result) {
            assert.deepEqual(result, ['a', 'b']);
        });
    });

    it('should resolve to empty array when no tasks and no args supplied', function () {
        return pipeline([]).then(function (result) {
            assert.deepEqual(result, []);
        });
    });

    it('should pass args to initial task', function () {
        const expected = [1, 2, 3];
        const tasks = [sinon.spy()];

        return pipeline(tasks, 1, 2, 3).then(function () {
            assert.equal(tasks[0].calledOnce, true);
            assert.deepEqual(tasks[0].firstCall.args, expected);
        });
    });

    it('should allow initial args to be promises', function () {
        const expected = [1, 2, 3];
        const tasks = [sinon.spy()];

        return pipeline(tasks, Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)).then(function () {
            assert.equal(tasks[0].calledOnce, true);
            assert.deepEqual(tasks[0].firstCall.args, expected);
        });
    });

    it('should allow tasks to be promises', function () {
        const expected = [1, 2, 3];

        const tasks = [
            sinon.stub().returns(Promise.resolve(4)),
            sinon.stub().returns(Promise.resolve(5)),
            sinon.stub().returns(Promise.resolve(6))
        ];

        return pipeline(tasks, 1, 2, 3).then(function (result) {
            assert.equal(result, 6);
            assert.equal(tasks[0].calledOnce, true);
            assert.deepEqual(tasks[0].firstCall.args, expected);
            assert.equal(tasks[1].calledOnce, true);
            assert.equal(tasks[1].firstCall.calledWith(4), true);
            assert.equal(tasks[2].calledOnce, true);
            assert.equal(tasks[2].firstCall.calledWith(5), true);
        });
    });

    it('should allow tasks and args to be promises', function () {
        const expected = [1, 2, 3];

        const tasks = [
            sinon.stub().returns(Promise.resolve(4)),
            sinon.stub().returns(Promise.resolve(5)),
            sinon.stub().returns(Promise.resolve(6))
        ];

        return pipeline(tasks, Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)).then(function (result) {
            assert.equal(result, 6);
            assert.equal(tasks[0].calledOnce, true);
            assert.deepEqual(tasks[0].firstCall.args, expected);
            assert.equal(tasks[1].calledOnce, true);
            assert.equal(tasks[1].firstCall.calledWith(4), true);
            assert.equal(tasks[2].calledOnce, true);
            assert.equal(tasks[2].firstCall.calledWith(5), true);
        });
    });
});
