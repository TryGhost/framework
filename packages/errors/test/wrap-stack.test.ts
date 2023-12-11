import assert from 'assert/strict';
import {wrapStack} from '../src/wrap-stack';

describe('wrapStack', function () {
    it('returns combined stack lines', function () {
        const ghostError = new Error('I am the ghost one!');
        ghostError.stack = 'ghost fn\nghost stack 1\nghost stack 2';
        const internalError = new Error('I am the internal one!');
        internalError.stack = 'internal fn\ninternal stack 1\ninternal stack 2';

        assert.equal(wrapStack(ghostError, internalError), 'internal fn\nghost stack 1\ninternal stack 1\ninternal stack 2');
    });

    it('handles errors without a stack', function () {
        const ghostError = new Error('I am the ghost one!');
        ghostError.stack = undefined;
        const internalError = new Error('I am the internal one!');
        internalError.stack = undefined;

        assert.equal(wrapStack(ghostError, internalError), '\n');
    });
});
