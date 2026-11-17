const assert = require('assert/strict');
const sinon = require('sinon');

class TestEvent {
    /**
     * @param {string} message
     */
    constructor(message) {
        this.timestamp = new Date();
        this.data = {
            message,
        };
    }
}

class OtherEvent {
    constructor() {
        this.timestamp = new Date();
        this.data = {};
    }
}

const sleep = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const loggingPath = require.resolve('@tryghost/logging');
const loggingKeyPattern = /^@tryghost\/logging@\d+$/;

function loggingRegistryKeys() {
    return Object.getOwnPropertySymbols(globalThis).filter((symbol) =>
        loggingKeyPattern.test(symbol.description),
    );
}

describe('@tryghost/domain-events/factory', function () {
    it('does not load @tryghost/logging or build a logger on import', function () {
        // This file never requires the main entry, so nothing has loaded logging
        const factory = require('../factory');

        assert.deepEqual(Object.keys(factory).sort(), ['EventBus', 'createEventBus']);
        assert.equal(require.cache[loggingPath], undefined);
        assert.deepEqual(loggingRegistryKeys(), []);

        factory.createEventBus({ logging: { error() {} } });

        assert.equal(require.cache[loggingPath], undefined);
        assert.deepEqual(loggingRegistryKeys(), []);
    });
});

describe('createEventBus', function () {
    const { createEventBus, EventBus } = require('../factory');

    let logging;
    let bus;

    beforeEach(function () {
        logging = { error: sinon.stub() };
        bus = createEventBus({ logging });
    });

    afterEach(function () {
        sinon.restore();
    });

    it('returns an EventBus', function () {
        assert.ok(bus instanceof EventBus);
    });

    it('requires a logger with an error() method', function () {
        const expected = {
            name: 'TypeError',
            message: /requires a `logging` option with an error\(\) method/,
        };

        assert.throws(() => createEventBus(), expected);
        assert.throws(() => createEventBus({}), expected);
        assert.throws(() => createEventBus({ logging: {} }), expected);
        assert.throws(() => createEventBus({ logging: { error: 'nope' } }), expected);
    });

    it('calls every subscriber with the dispatched event', async function () {
        const event = new TestEvent('Hello, world!');
        const received = [];

        bus.subscribe(TestEvent, (e) => received.push(['first', e]));
        bus.subscribe(TestEvent, (e) => received.push(['second', e]));
        bus.subscribe(OtherEvent, (e) => received.push(['other', e]));

        bus.dispatch(event);
        await bus.allSettled();

        assert.deepEqual(received, [
            ['first', event],
            ['second', event],
        ]);
    });

    it('subscribe returns nothing', function () {
        assert.equal(
            bus.subscribe(TestEvent, () => {}),
            undefined,
        );
    });

    it('dispatchRaw dispatches by event name', async function () {
        const received = [];
        const data = { any: 'payload' };

        bus.subscribe(TestEvent, (e) => received.push(e));

        bus.dispatchRaw('TestEvent', data);
        await bus.allSettled();

        assert.deepEqual(received, [data]);
    });

    it('logs sync and async handler errors to the given logger', async function () {
        const syncError = new Error('sync');
        const asyncError = new Error('async');

        bus.subscribe(TestEvent, () => {
            throw syncError;
        });
        bus.subscribe(TestEvent, async () => {
            await sleep(5);
            throw asyncError;
        });

        bus.dispatch(new TestEvent('boom'));
        await bus.allSettled();

        assert.deepEqual(
            logging.error.args.map(([arg]) => arg),
            [
                'Unhandled error in event handler for event: TestEvent',
                syncError,
                'Unhandled error in event handler for event: TestEvent',
                asyncError,
            ],
        );
    });

    it('keeps subscribers and tracking separate between buses', async function () {
        const other = createEventBus({ logging });
        const handler = sinon.stub();
        const otherHandler = sinon.stub();

        bus.subscribe(TestEvent, handler);
        other.subscribe(TestEvent, async () => {
            await sleep(20);
            otherHandler();
        });

        other.dispatch(new TestEvent('other only'));
        // Nothing is pending on `bus`, so this resolves before `other` settles
        await bus.allSettled();

        assert.equal(handler.called, false);
        assert.equal(otherHandler.called, false);

        await other.allSettled();
        assert.equal(otherHandler.calledOnce, true);
    });

    describe('unsubscribe', function () {
        it('stops a handler receiving events', async function () {
            const removed = sinon.stub();
            const kept = sinon.stub();

            bus.subscribe(TestEvent, removed);
            bus.subscribe(TestEvent, kept);

            assert.equal(bus.unsubscribe(TestEvent, removed), true);

            bus.dispatch(new TestEvent('after unsubscribe'));
            await bus.allSettled();

            assert.equal(removed.called, false);
            assert.equal(kept.calledOnce, true);
        });

        it('returns false when the handler is not subscribed to that event', function () {
            const handler = sinon.stub();

            assert.equal(bus.unsubscribe(TestEvent, handler), false);

            bus.subscribe(OtherEvent, handler);

            assert.equal(bus.unsubscribe(TestEvent, handler), false);
            assert.equal(bus.ee.listenerCount('OtherEvent'), 1);
        });

        it('removes one subscription per call', async function () {
            const handler = sinon.stub();

            bus.subscribe(TestEvent, handler);
            bus.subscribe(TestEvent, handler);

            assert.equal(bus.unsubscribe(TestEvent, handler), true);

            bus.dispatch(new TestEvent('once'));
            await bus.allSettled();
            assert.equal(handler.callCount, 1);

            assert.equal(bus.unsubscribe(TestEvent, handler), true);
            assert.equal(bus.unsubscribe(TestEvent, handler), false);
        });

        it('does not stall allSettled for a handler already running', async function () {
            let finished = false;
            const handler = async () => {
                await sleep(10);
                finished = true;
            };

            bus.subscribe(TestEvent, handler);
            bus.dispatch(new TestEvent('in flight'));
            bus.unsubscribe(TestEvent, handler);

            await bus.allSettled();
            assert.equal(finished, true);
        });
    });

    describe('tracking', function () {
        it('allSettled resolves immediately when nothing was dispatched', async function () {
            await bus.allSettled();
        });

        it('allSettled waits for every listener', async function () {
            let resolveFirst;
            let resolveSecond;

            bus.subscribe(TestEvent, () => new Promise((resolve) => (resolveFirst = resolve)));
            bus.subscribe(TestEvent, () => new Promise((resolve) => (resolveSecond = resolve)));

            bus.dispatch(new TestEvent('Hello, world!'));

            let settled = false;
            const allSettled = bus.allSettled().then(() => {
                settled = true;
            });

            resolveFirst();
            await sleep(0);
            assert.equal(settled, false);

            resolveSecond();
            await allSettled;
            assert.equal(settled, true);
        });

        it('still delivers events when tracking is disabled', async function () {
            const handler = sinon.stub();

            bus.setTrackingEnabledForTest(false);
            bus.subscribe(TestEvent, handler);
            bus.dispatch(new TestEvent('No tracking'));

            await sleep(0);
            await bus.allSettled();

            assert.equal(handler.calledOnce, true);
        });

        it('resetTrackingStateForTest clears pending counts', async function () {
            bus.subscribe(TestEvent, () => new Promise(() => {}));
            bus.dispatch(new TestEvent('never settles'));

            bus.resetTrackingStateForTest();

            await bus.allSettled();
        });
    });
});
