const DomainEvents = require('../');
const assert = require('assert/strict');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;
const factory = require('../factory');

class TestEvent {
    constructor() {
        this.timestamp = new Date();
        this.data = {};
    }
}

describe('DomainEvents static API over the default bus', function () {
    const originalEmitter = DomainEvents.ee;

    afterEach(function () {
        sinon.restore();
        DomainEvents.ee = originalEmitter;
        DomainEvents.ee.removeAllListeners();
        DomainEvents.resetTrackingStateForTest();
    });

    it('exposes createEventBus on the main entry', function () {
        assert.equal(DomainEvents.createEventBus, factory.createEventBus);

        const bus = DomainEvents.createEventBus({ logging: { error() {} } });
        assert.ok(bus instanceof factory.EventBus);
    });

    it('keeps listeners on DomainEvents.ee', function () {
        assert.ok(DomainEvents.ee instanceof EventEmitter);

        DomainEvents.subscribe(TestEvent, () => {});

        assert.equal(DomainEvents.ee.listenerCount('TestEvent'), 1);
    });

    it('dispatchRaw reaches subscribers by event name', async function () {
        const handler = sinon.stub();
        const data = { any: 'payload' };

        DomainEvents.subscribe(TestEvent, handler);
        DomainEvents.dispatchRaw('TestEvent', data);
        await DomainEvents.allSettled();

        assert.equal(handler.calledOnceWithExactly(data), true);
    });

    it('follows DomainEvents.ee when it is replaced', async function () {
        const before = sinon.stub();
        const after = sinon.stub();
        const replacement = new EventEmitter();

        DomainEvents.subscribe(TestEvent, before);
        DomainEvents.ee = replacement;
        DomainEvents.subscribe(TestEvent, after);

        assert.equal(replacement.listenerCount('TestEvent'), 1);
        assert.equal(originalEmitter.listenerCount('TestEvent'), 1);

        DomainEvents.dispatch(new TestEvent());
        await DomainEvents.allSettled();

        assert.equal(before.called, false);
        assert.equal(after.calledOnce, true);
    });

    it('is separate from buses made with createEventBus', async function () {
        const staticHandler = sinon.stub();
        const busHandler = sinon.stub();
        const bus = DomainEvents.createEventBus({ logging: { error() {} } });

        DomainEvents.subscribe(TestEvent, staticHandler);
        bus.subscribe(TestEvent, busHandler);

        bus.dispatch(new TestEvent());
        await bus.allSettled();

        assert.equal(busHandler.calledOnce, true);
        assert.equal(staticHandler.called, false);
    });
});
