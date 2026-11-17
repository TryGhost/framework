const assert = require('assert/strict');
const sinon = require('sinon');

const loggingPath = require.resolve('@tryghost/logging');
const loggingKeyPattern = /^@tryghost\/logging@\d+$/;

function loggingRegistryKeys() {
    return Object.getOwnPropertySymbols(globalThis).filter((symbol) =>
        loggingKeyPattern.test(symbol.description),
    );
}

class TestEvent {
    constructor() {
        this.timestamp = new Date();
        this.data = {};
    }
}

describe('DomainEvents main entry and @tryghost/logging', function () {
    afterEach(function () {
        sinon.restore();
    });

    // Order matters: the first test relies on nothing in this file having
    // loaded logging yet.
    it('does not load logging or build a logger on import or on successful dispatch', async function () {
        const DomainEvents = require('../');
        const handler = sinon.stub();

        DomainEvents.subscribe(TestEvent, handler);
        DomainEvents.dispatch(new TestEvent());
        await DomainEvents.allSettled();
        DomainEvents.ee.removeAllListeners();

        assert.equal(handler.calledOnce, true);
        assert.equal(require.cache[loggingPath], undefined);
        assert.deepEqual(loggingRegistryKeys(), []);
    });

    it('logs handler errors through the logger registered after import', async function () {
        const DomainEvents = require('../');
        const { createLogger, setInstance } = require('@tryghost/logging/factory');
        const logger = setInstance(createLogger({ transports: [] }));
        const error = sinon.stub(logger, 'error');
        const failure = new Error('Test error');

        DomainEvents.subscribe(TestEvent, () => {
            throw failure;
        });
        DomainEvents.dispatch(new TestEvent());
        await DomainEvents.allSettled();
        DomainEvents.ee.removeAllListeners();

        assert.deepEqual(
            error.args.map(([arg]) => arg),
            ['Unhandled error in event handler for event: TestEvent', failure],
        );
        assert.equal(require('@tryghost/logging'), logger);
    });
});
