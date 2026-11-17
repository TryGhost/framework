const EventEmitter = require('events').EventEmitter;

/**
 * @template T
 * @typedef {import('./').ConstructorOf<T>} ConstructorOf<T>
 */

/**
 * @template Data
 * @typedef {object} IEvent
 * @prop {Date} timestamp
 * @prop {Data} data
 */

/**
 * @typedef {object} Logger
 * @prop {(...args: any[]) => unknown} error
 */

// Links the listener registered on the emitter back to the handler it wraps,
// so unsubscribe() can find it.
const HANDLER = Symbol('handler');

class EventBus {
    /**
     * @type EventEmitter
     */
    ee = new EventEmitter();

    /** @type {Logger} */
    #logging;

    /**
     * @param {object} options
     * @param {Logger} options.logging Logger used to report errors thrown by handlers
     */
    constructor({ logging } = {}) {
        if (!logging || typeof logging.error !== 'function') {
            throw new TypeError(
                '@tryghost/domain-events: createEventBus() requires a `logging` option with an error() method',
            );
        }

        this.#logging = logging;
    }

    /**
     * @template Data
     * @template {IEvent<Data>} EventClass
     * @param {ConstructorOf<EventClass>} Event
     * @param {(event: EventClass) => Promise<void> | void} handler
     *
     * @returns {void}
     */
    subscribe(Event, handler) {
        const listener = async (event) => {
            try {
                await handler(event);
            } catch (e) {
                this.#logging.error('Unhandled error in event handler for event: ' + Event.name);
                this.#logging.error(e);
            }
            if (this.#trackingEnabled) {
                this.#onProcessed();
            } else {
                // Tracking is disabled outside tests.
            }
        };
        listener[HANDLER] = handler;

        this.ee.on(Event.name, listener);
    }

    /**
     * Remove a handler added with subscribe(). A handler subscribed more than
     * once is removed one subscription per call, most recent first.
     *
     * @template Data
     * @template {IEvent<Data>} EventClass
     * @param {ConstructorOf<EventClass>} Event
     * @param {(event: EventClass) => Promise<void> | void} handler
     *
     * @returns {boolean} Whether a subscription was removed
     */
    unsubscribe(Event, handler) {
        const listener = this.ee
            .listeners(Event.name)
            .findLast((candidate) => candidate[HANDLER] === handler);

        if (!listener) {
            return false;
        }

        this.ee.off(Event.name, listener);
        return true;
    }

    /**
     * @template Data
     * @param {IEvent<Data>} event
     * @returns {void}
     */
    dispatch(event) {
        this.dispatchRaw(event.constructor.name, event);
    }

    /**
     * Dispatch an event in case you don't have an instance of the event class, but you do have the event name and event data.
     * @template Data
     * @param {string} name
     * @param {Data} data
     * @returns {void}
     */
    dispatchRaw(name, data) {
        if (this.#trackingEnabled) {
            this.#dispatchCount += this.ee.listenerCount(name);
        } else {
            // Tracking is disabled outside tests.
        }
        this.ee.emit(name, data);
    }

    // Methods and properties below are only for testing purposes
    #awaitQueue = [];
    #dispatchCount = 0;
    #processedCount = 0;
    #trackingEnabled = process.env.NODE_ENV?.startsWith('test');

    /**
     * Waits for all the events in the queue to be dispatched and fully processed (async).
     */
    allSettled() {
        return new Promise((resolve) => {
            if (this.#processedCount >= this.#dispatchCount) {
                // Resolve immediately if there are no events in the queue
                resolve();
                return;
            } else {
                this.#awaitQueue.push({ resolve });
            }
        });
    }

    #onProcessed() {
        this.#processedCount += 1;
        if (this.#processedCount >= this.#dispatchCount) {
            for (const item of this.#awaitQueue) {
                item.resolve();
            }
            this.#awaitQueue = [];
        } else {
            // Wait for the remaining tracked listeners.
        }
    }

    /**
     * Enable or disable dispatch/processed tracking. Test-only.
     * @param {boolean} enabled
     */
    setTrackingEnabledForTest(enabled) {
        this.#trackingEnabled = enabled;
    }

    /**
     * Clear the await queue and reset dispatch/processed counts. Test-only.
     */
    resetTrackingStateForTest() {
        this.#awaitQueue = [];
        this.#dispatchCount = 0;
        this.#processedCount = 0;
    }
}

module.exports = EventBus;
