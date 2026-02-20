const assert = require('node:assert/strict');
const sinon = require('sinon');
const transactionEvents = require('../index');

describe('@tryghost/bookshelf-transaction-events', function () {
    let bookshelf;
    let transactionState;

    beforeEach(function () {
        transactionState = {};

        bookshelf = {
            transaction(callback) {
                transactionState.boundThis = this;
                const trx = {
                    emit: sinon.stub(),
                    commit: sinon.stub().resolves('COMMIT_RETURN'),
                    rollback: sinon.stub().resolves('ROLLBACK_RETURN')
                };
                transactionState.trx = trx;
                transactionState.originalCommit = trx.commit;
                transactionState.originalRollback = trx.rollback;
                return callback(trx);
            }
        };
    });

    afterEach(function () {
        sinon.restore();
    });

    it('exports plugin from index', function () {
        assert.equal(typeof require('../index'), 'function');
    });

    it('patches transaction and emits committed=true after commit resolves', async function () {
        transactionEvents(bookshelf);

        const result = await bookshelf.transaction(async function (trx) {
            return trx.commit('arg');
        });

        assert.equal(result, 'COMMIT_RETURN');
        assert.equal(transactionState.boundThis, bookshelf);
        assert.equal(transactionState.originalCommit.calledOnceWithExactly('arg'), true);
        assert.equal(transactionState.trx.emit.calledOnceWithExactly('committed', true), true);
        sinon.assert.callOrder(transactionState.originalCommit, transactionState.trx.emit);
    });

    it('emits committed=false after rollback resolves', async function () {
        transactionEvents(bookshelf);

        const result = await bookshelf.transaction(async function (trx) {
            return trx.rollback('reason');
        });

        assert.equal(result, 'ROLLBACK_RETURN');
        assert.equal(transactionState.originalRollback.calledOnceWithExactly('reason'), true);
        assert.equal(transactionState.trx.emit.calledOnceWithExactly('committed', false), true);
        sinon.assert.callOrder(transactionState.originalRollback, transactionState.trx.emit);
    });

    it('returns callback return value', async function () {
        transactionEvents(bookshelf);

        const value = await bookshelf.transaction(async function () {
            return 'CALLBACK_VALUE';
        });

        assert.equal(value, 'CALLBACK_VALUE');
    });
});
