const assert = require('assert');
const sinon = require('sinon');

const Knex = require('knex');
const transactionEvents = require('../index');

describe('Bookshelf transaction events', function () {
    let knex;

    beforeEach(async function () {
        knex = await Knex({
            client: 'sqlite',
            connection: {
                filename: ':memory:'
            },
            // Suppress warnings from knex
            useNullAsDefault: true
        });
    });

    afterEach(function () {
        knex.destroy();
    });

    it('Monkey patches bookshelf to emit transaction "committed" events AFTER transaction is committed', async function () {
        transactionEvents(knex);

        const trx = await knex.transaction();
        trx.emit = sinon.spy(trx, 'emit');
        trx.commit = sinon.spy(trx, 'commit');

        await trx.commit();

        assert(trx.isCompleted());
        assert(trx.commit.calledBefore(trx.emit));
    });
});
